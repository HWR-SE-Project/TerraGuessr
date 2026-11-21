import { chromium, expect, test } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('live Google survives genuine browser zoom with the same panorama and guess', async ({baseURL}) => {
  test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires live Maps credentials and backend')
  test.setTimeout(180_000)
  const profile=await mkdtemp(join(tmpdir(),'terraguessr-live-zoom-'))
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',viewport:null,deviceScaleFactor:undefined,baseURL,args:['--window-size=1711,864']})
  const out='docs/screenshots/responsive/after'
  await mkdir(out,{recursive:true})
  const report:unknown[]=[]
  try {
    const settings=await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page=await context.newPage()
    const errors:string[]=[]
    page.on('pageerror',e=>errors.push(e.message.replace(/AIza[\w-]+/g,'[REDACTED]')))
    await page.goto('/game/singleplayer')
    await page.getByRole('button',{name:'Start exploring'}).click()
    const panorama=page.locator('.sp-panorama')
    await expect(panorama).toHaveAttribute('data-ready','true',{timeout:45_000})
    await page.getByRole('button',{name:'Game settings'}).click()
    await page.getByRole('switch',{name:'Expand map on hover'}).uncheck()
    await page.keyboard.press('Escape')
    const map=page.locator('.sp-guess-panel .sp-google-map')
    await expect(map.locator('img').first()).toBeVisible({timeout:15_000})
    await map.click({position:{x:150,y:90}})
    await expect(page.getByRole('button',{name:'Guess',exact:true})).toBeEnabled()
    const pin=await page.locator('.sp-map-footer > span').innerText()
    const node=await panorama.elementHandle()
    const pano=await panorama.getAttribute('data-panorama')
    for(const zoom of [50,67,75,80,90,100,110,125,150,175,200]) {
      await settings.locator('#zoomLevel').selectOption({label:`${zoom}%`})
      await expect.poll(()=>page.evaluate(()=>devicePixelRatio)).toBeCloseTo(zoom/100,1)
      await expect(panorama).toHaveAttribute('data-ready','true')
      await expect(panorama).toHaveAttribute('data-panorama',pano!)
      expect(await node!.evaluate(el=>el.isConnected)).toBe(true)
      await expect(page.locator('.sp-map-footer > span')).toHaveText(pin)
      const guess=page.getByRole('button',{name:'Guess',exact:true})
      await guess.scrollIntoViewIfNeeded()
      await expect(guess).toBeEnabled()
      await expect(guess).toBeInViewport()
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
      const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))
      report.push({zoom,...metrics,panoramaRetained:true,pinRetained:true})
      if([50,100,200].includes(zoom)) {
        await page.evaluate(()=>scrollTo(0,0))
        const cdp=await context.newCDPSession(page)
        const {contentSize}=await cdp.send('Page.getLayoutMetrics')
        const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:contentSize.width,height:contentSize.height,scale:1}})
        await writeFile(`${out}/live-gameplay-zoom-${zoom}.png`,Buffer.from(shot.data,'base64'))
        await cdp.detach()
      }
    }
    const response=page.waitForResponse(r=>r.url().endsWith('/guess')&&r.request().method()==='POST')
    await page.getByRole('button',{name:'Guess',exact:true}).click()
    expect((await response).ok()).toBe(true)
    await expect(page.getByRole('region',{name:'Round results'})).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await writeFile(`${out}/live-zoom-results.json`,JSON.stringify(report,null,2))
    await context.close()
    await rm(profile,{recursive:true,force:true})
  }
})
