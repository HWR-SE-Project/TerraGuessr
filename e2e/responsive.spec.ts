import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const output = 'docs/screenshots/responsive/after'
const sizes = [[1920,1080],[1711,864],[1440,900],[1366,768],[768,1024],[390,844],[375,812]] as const
const zooms = [50,67,75,80,90,100,110,125,150,175,200]

/** Playwright's screenshot clip uses CSS pixels even under genuine browser
 * zoom. CDP's DIP content bounds preserve the whole physical capture. */
async function capture(page: Page, path: string) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.sp-page')?.scrollTo(0, 0) })
  const cdp = await page.context().newCDPSession(page)
  const { contentSize } = await cdp.send('Page.getLayoutMetrics')
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } })
  await writeFile(path, Buffer.from(result.data, 'base64'))
  await cdp.detach()
}

async function offlineProviders(page: Page) {
  await page.route('**/maps.googleapis.com/maps/api/js?*', route => route.abort())
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available: true, provider: 'google', serverKeyConfigured: true } }))
}

async function audit(page: Page) {
  const failures = await page.evaluate(() => {
    const issues: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document horizontal overflow')
    const dialog = document.querySelector('dialog[open], [role="alertdialog"]')
    const scope = dialog ?? document
    const visibleRect = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      let left=rect.left, right=rect.right, top=rect.top, bottom=rect.bottom
      for(let parent=el.parentElement; parent; parent=parent.parentElement) {
        const css=getComputedStyle(parent), bounds=parent.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left=Math.max(left,bounds.left); right=Math.min(right,bounds.right) }
        if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top=Math.max(top,bounds.top); bottom=Math.min(bottom,bounds.bottom) }
      }
      return {left,right,top,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}
    }
    const controls = [...scope.querySelectorAll<HTMLElement>('button, a, input, select')].filter(el => {
      const r = visibleRect(el)
      const topbar = dialog?.querySelector('.tt-topbar')
      const underStickyHeader = topbar && !topbar.contains(el) && r.top < topbar.getBoundingClientRect().bottom
      return !underStickyHeader && r.width && r.height && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden], [inert], .sp-google-map, .sp-panorama, .leaflet-container') && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    })
    for (let i=0; i<controls.length; i++) {
      const a=controls[i]!, ar=visibleRect(a)
      if (ar.left < -1 || ar.right > innerWidth + 1) issues.push(`control outside horizontal viewport: ${a.ariaLabel || a.textContent}`)
      // Ignore scrollable content above/below the visible area; it must remain reachable.
      for (let j=i+1; j<controls.length; j++) {
        const b=controls[j]!
        if (a.contains(b) || b.contains(a)) continue
        const br=visibleRect(b)
        if (Math.min(ar.right, br.right)-Math.max(ar.left,br.left)>2 && Math.min(ar.bottom,br.bottom)-Math.max(ar.top,br.top)>2) {
          issues.push(`overlap: ${a.ariaLabel || a.textContent?.trim()} / ${b.ariaLabel || b.textContent?.trim()}`)
        }
      }
    }
    return issues
  })
  expect(failures).toEqual([])
}

async function reachable(page: Page, selector: string) {
  const element = page.locator(selector).first()
  await element.scrollIntoViewIfNeeded()
  await expect(element).toBeInViewport()
  expect(await element.evaluate(el => {
    const r=el.getBoundingClientRect()
    const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2)
    return !!hit && (el.contains(hit) || hit.contains(el))
  })).toBe(true)
  await audit(page)
}

async function home(page: Page, screenshot?: string, navigate = true) {
  if (navigate) await page.goto('/')
  await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
  await expect.poll(() => page.locator('.th-avatar-display').evaluate(el => el.style.getPropertyValue('--feet-y'))).not.toBe('')
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('canvas')!.getBoundingClientRect().width - innerWidth))).toBeLessThan(2)
  await expect.poll(() => page.evaluate(() => {
    const slot = document.querySelector('.th-character-slot')!.getBoundingClientRect()
    const button = document.querySelector('.th-edit-avatar')!.getBoundingClientRect()
    return (button.top - slot.top) / slot.height
  })).toBeGreaterThan(0.7)
  const geometry = await page.evaluate(() => {
    const slot = document.querySelector('.th-character-slot')!.getBoundingClientRect()
    const copy = document.querySelector('.th-hero-copy')!.getBoundingClientRect()
    const edit = document.querySelector('.th-edit-avatar')!.getBoundingClientRect()
    const canvas = document.querySelector('canvas')!.getBoundingClientRect()
    return { gap: slot.top-copy.bottom, centered: Math.abs(slot.left+slot.width/2-innerWidth/2), button: edit.top-slot.top, height:slot.height, canvasWidth:canvas.width }
  })
  expect(geometry.gap).toBeGreaterThan(0)
  expect(geometry.centered).toBeLessThan(2)
  expect(geometry.button).toBeGreaterThan(geometry.height * 0.7)
  expect(geometry.button).toBeLessThan(geometry.height)
  expect(Math.abs(geometry.canvasWidth - (await page.evaluate(() => innerWidth)))).toBeLessThan(2)
  await audit(page)
  await reachable(page, '.th-edit-avatar')
  await page.getByRole('button', {name:'Edit Avatar'}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await audit(page)
  await page.keyboard.press('Escape')
  for (const selector of ['.th-tutorial-entry', '.tg-mode-card:nth-child(1)', '.tg-mode-card:nth-child(2)', '.tg-mode-card:nth-child(3)']) await reachable(page, selector)
  await page.evaluate(() => scrollTo(0,0))
  if (screenshot) await capture(page, `${output}/home-${screenshot}.png`)
}

async function routes(page: Page, screenshot?: string) {
  await page.goto('/auth')
  await audit(page)
  await page.getByRole('button',{name:'Continue with Email'}).click()
  await reachable(page, 'input[type="email"]')
  await reachable(page, '.tg-email-submit')
  if (screenshot) await capture(page, `${output}/auth-${screenshot}.png`)
  await page.goto('/duels')
  await reachable(page, '.td-play')
  if (screenshot) await capture(page, `${output}/duels-${screenshot}.png`)
  await page.goto('/game/singleplayer')
  await expect(page.locator('.sp-difficulty-option')).toHaveCount(3)
  for (const label of ['Easy','Medium','Hard']) await page.getByRole('radio',{name:new RegExp(label)}).click()
  await reachable(page, '.sp-welcome .sp-primary')
  if (screenshot) await capture(page, `${output}/setup-${screenshot}.png`)
  await page.getByRole('button',{name:'Game settings'}).click()
  await audit(page)
  await reachable(page, '.sp-dialog .sp-wide')
  if (screenshot) await capture(page, `${output}/settings-${screenshot}.png`)
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Game menu'}).click()
  await audit(page)
  await page.getByRole('button',{name:'How to Play / Tutorial'}).click()
  const dialog=page.getByRole('dialog',{name:'How to play / Tutorial'})
  for (const [i,subject] of ['Weather','Location','Confirmation','Distance','Points'].entries()) {
    await dialog.getByRole('button',{name:`Step ${i+1}: ${subject}`}).click()
    await reachable(page, '.tt-navigation button:last-child')
    expect(await dialog.evaluate(el=>el.scrollWidth <= el.clientWidth+1)).toBe(true)
  }
  if (screenshot) await capture(page, `${output}/tutorial-${screenshot}.png`)
  await page.keyboard.press('Escape')
  await page.goto('/settings')
  await audit(page)
}

// 'round' (RoundResults) is intentionally not covered here: reaching it
// requires a real submitted guess, which needs a genuinely ready Street View
// panorama (loadGoogleMaps()) — not reachable with Maps JS stubbed out, and
// Street View integration is out of scope to fake. It gets real visual
// coverage from singleplayer.live.spec.ts instead. Endless mode also removed
// session-resume, which used to be how this helper jumped straight to a
// pre-scored state — both phases below are now reached via genuine play.
async function zoomGameSurfaces(page: Page, suffix?: string) {
  const result = { roundId:'zoom-round', number:1, guess:{lat:51,lon:0}, actual:{lat:48,lon:2}, distanceKm:343.6, score:4210 }
  const session = { id:'responsive-zoom', difficulty:'medium', totalScore:4210, activeRound:null as null | { id:string; number:number; panoId:string }, results:[result] }
  await page.route('**/api/singleplayer/games', route => route.fulfill({ status:201, json:{ id:'responsive-zoom', playerToken:'test-only' } }))
  await page.route('**/api/singleplayer/games/responsive-zoom/rounds', route => route.fulfill({ status:201, json:{ id:result.roundId, number:2, panoId:'offline-test' } }))
  await page.route('**/api/singleplayer/games/responsive-zoom/rounds/*/intelligence', route => route.fulfill({ status:503, json:{ error:{ code:'UNAVAILABLE', message:'Offline fixture' } } }))
  await page.route('**/api/singleplayer/games/responsive-zoom', route =>
    route.request().method() === 'DELETE' ? route.fulfill({ status:204 }) : route.fulfill({ json: session }))
  await page.goto('/game/singleplayer')
  await page.getByRole('button', {name:/Start exploring/}).click()
  await page.getByRole('dialog', {name:'How to play / Tutorial'}).getByRole('button', {name:'Skip'}).click()
  for (const phase of ['active', 'final']) {
    if (phase === 'active') {
      await expect(page.locator('.sp-panorama')).toBeVisible()
      await reachable(page, '.sp-guess-button')
      const mobile = page.getByRole('button', {name:'Open geographic intelligence'})
      if (await mobile.isVisible()) {
        await mobile.click()
        await audit(page)
        await page.keyboard.press('Escape')
      }
    } else {
      await page.getByRole('button', {name:'Return', exact:true}).click()
      await page.getByRole('dialog', {name:'End your adventure?'}).getByRole('button', {name:'End Game'}).click()
      await expect(page.getByRole('region', {name:'Final results'})).toBeVisible()
      await reachable(page, '.sp-result-actions button')
    }
    if (suffix) await capture(page, `${output}/${phase}-${suffix}.png`)
  }
}

for (const [width,height] of sizes) {
  test(`responsive routes and dialogs ${width}x${height}`, async ({page}) => {
    test.setTimeout(120_000)
    await mkdir(output,{recursive:true})
    await page.emulateMedia({reducedMotion:'reduce'})
    await offlineProviders(page)
    const errors:string[]=[]
    page.on('pageerror', e=>errors.push(e.message))
    const models: string[] = []
    page.on('request', request => { if (request.url().includes('.glb')) models.push(request.url()) })
    await home(page)
    const modelLoads = models.length
    await page.setViewportSize({width,height})
    // Re-measure an already mounted scene, not just the initial responsive layout.
    await home(page, `${width}x${height}`, false)
    expect(models.length).toBe(modelLoads)
    await routes(page, `${width}x${height}`)
    expect(errors).toEqual([])
  })
}

test('genuine Chromium browser zoom 50–200%: routes, composition and dialogs', async ({baseURL}) => {
  test.setTimeout(600_000)
  const profile=await mkdtemp(join(tmpdir(),'terraguessr-responsive-zoom-'))
  const context=await chromium.launchPersistentContext(profile, {channel:'chromium', viewport:null, deviceScaleFactor:undefined, baseURL, reducedMotion:'reduce', args:['--window-size=1711,864']})
  const report=[]
  try {
    const settings=await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page=await context.newPage()
    await offlineProviders(page)
    await page.route('**/intelligence', route=>route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Offline fixture'}}}))
    page.on('dialog', dialog=>void dialog.accept())
    const errors:string[]=[]
    page.on('pageerror',e=>errors.push(e.message))
    for (const zoom of zooms) {
      await settings.locator('#zoomLevel').selectOption({label:`${zoom}%`})
      await home(page, `zoom-${zoom}`)
      const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))
      expect(metrics.dpr).toBeCloseTo(zoom/100,1)
      await routes(page, [50,100,200].includes(zoom)?`zoom-${zoom}`:undefined)
      await zoomGameSurfaces(page, [50,100,200].includes(zoom)?`zoom-${zoom}`:undefined)
      report.push({zoom,...metrics,result:'passed'})
    }
    expect(errors).toEqual([])
  } finally {
    await writeFile(`${output}/browser-zoom-results.json`,JSON.stringify(report,null,2))
    await context.close()
    await rm(profile,{recursive:true,force:true})
  }
})

// 'round' is covered by the live spec only — see the comment on
// zoomGameSurfaces above for why it can't be reached in this offline harness.
for (const phase of ['active','final']) {
  test(`responsive ${phase} gameplay surfaces preserve session and controls`,async ({page})=>{
    test.setTimeout(120_000)
    await offlineProviders(page)
    const result={roundId:'responsive-round',number:1,guess:{lat:51,lon:0},actual:{lat:48,lon:2},distanceKm:343.6,score:4210}
    const session={id:'responsive-game',difficulty:'medium',totalScore:4210,activeRound:null as null | {id:string;number:number;panoId:string},results:[result]}
    await page.route('**/api/singleplayer/games',route=>route.fulfill({status:201,json:{id:'responsive-game',playerToken:'test-token'}}))
    await page.route('**/api/singleplayer/games/responsive-game/rounds',route=>route.fulfill({status:201,json:{id:result.roundId,number:2,panoId:'offline-test'}}))
    await page.route('**/api/singleplayer/games/responsive-game',route=>
      route.request().method()==='DELETE' ? route.fulfill({status:204}) : route.fulfill({json:session}))
    await page.route('**/intelligence',r=>r.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Offline fixture'}}}))
    await page.goto('/game/singleplayer')
    await page.getByRole('button',{name:/Start exploring/}).click()
    await page.getByRole('dialog',{name:'How to play / Tutorial'}).getByRole('button',{name:'Skip'}).click()
    if (phase === 'final') {
      await page.getByRole('button',{name:'Return',exact:true}).click()
      await page.getByRole('dialog',{name:'End your adventure?'}).getByRole('button',{name:'End Game'}).click()
      await expect(page.getByRole('region',{name:'Final results'})).toBeVisible()
    }
    for (const [width,height] of [...sizes,[856,432] as const]) {
      await page.setViewportSize({width,height})
      await page.waitForTimeout(150)
      await audit(page)
      if(phase==='active') {
        await reachable(page,'.sp-guess-button')
        await page.getByRole('button',{name:'Expand map',exact:true}).click()
        await page.mouse.move(0,0)
        await reachable(page,'.sp-guess-button')
        await page.getByRole('button',{name:'Shrink map',exact:true}).click()
        if(width<=1000) {
          await page.getByRole('button',{name:'Open geographic intelligence'}).click()
          await audit(page)
          await page.keyboard.press('Escape')
        }
      } else {
        await expect(page.getByRole('region',{name:'Final results'})).toBeVisible()
        await reachable(page,'.sp-result-actions button')
        await page.locator('.sp-round-list summary').click()
        await reachable(page,'.sp-result-actions button:last-child')
      }
      if([1920,390,856].includes(width)) await capture(page, `${output}/${phase}-${width}x${height}.png`)
    }
  })
}


test('responsive account settings, preferences and confirmation dialog', async ({page}) => {
  test.setTimeout(120_000)
  await page.route('**/api/auth/session', route=>route.fulfill({json:{
    user:{id:'responsive-account',displayName:'An explorer with a long display name',email:'explorer-with-a-long-email-address@example.test',hasPassword:true},
    preferences:{language:'en',soundFxVolume:60,musicVolume:50,fullscreen:false},
  }}))
  await page.goto('/settings')
  for (const [width,height] of [...sizes,[856,432] as const]) {
    await page.setViewportSize({width,height})
    await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible()
    await audit(page)
    await page.getByRole('button',{name:'Change email'}).click()
    await reachable(page, 'input[aria-label="New email address"]')
    await page.getByRole('button',{name:'Cancel',exact:true}).click()
    await page.getByRole('button',{name:'Delete my account'}).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await reachable(page, '.tg-confirm-cancel')
    await page.getByRole('button',{name:'Cancel',exact:true}).click()
    await page.getByRole('button',{name:'Preferences',exact:true}).click()
    await reachable(page, '.settings-language-select select')
    if([1920,390,856].includes(width)) await capture(page,`${output}/account-${width}x${height}.png`)
    await page.getByRole('button',{name:'Account',exact:true}).click()
  }
})

test('compact navigation expands in flow and keeps primary routes reachable', async ({page}) => {
  await page.goto('/')
  for (const width of [375,390,768,1000]) {
    await page.setViewportSize({width,height:812})
    await page.getByRole('button',{name:'Open navigation'}).click()
    await audit(page)
    const navigation=page.getByRole('navigation',{name:'Main navigation'})
    await expect(navigation.getByRole('link',{name:'Singleplayer'})).toBeInViewport()
    await expect(navigation.getByRole('link',{name:'Multiplayer'})).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button',{name:'Open navigation'})).toBeFocused()
  }
  await page.getByRole('button',{name:'Open navigation'}).click()
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Singleplayer'}).click()
  await expect(page).toHaveURL(/\/game\/singleplayer$/)
  await expect(page.getByRole('main',{name:'TerraGuessr singleplayer game'})).toBeVisible()
})
