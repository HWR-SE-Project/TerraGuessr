import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.CHARACTER_BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width:1711, height:864 }, reducedMotion:'no-preference',
  recordVideo: { dir:out, size:{width:1711,height:864} },
})
const page = await context.newPage()
const results = { url:base, errors:[], samples:[], passed:false }
page.on('pageerror', error => results.errors.push(error.message))
const video = page.video()
try {
  await page.goto(base)
  await page.locator('[data-character-status="ready"]').waitFor()
  await page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js')
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')
    const THREE = await import('/node_modules/three/build/three.module.js')
    const reference = await new GLTFLoader().loadAsync('/src/assets/home/scene/puppet-kid.glb')
    const referenceMixer = new THREE.AnimationMixer(reference.scene)
    referenceMixer.clipAction(reference.animations.find(clip => clip.name === 'Idle')).play()
    let loops = 0, currentMixer
    window.bodyAnimationSample = () => {
      let animation, motion, gaze, instance, rig
      const walk = node => {
        if (!node) return
        if (node.stateNode?.object?.name === 'home-explorer-motion') {
          instance=node.stateNode; motion=instance.object
        }
        for (let hook=node.memoizedState; hook; hook=hook.next) {
          const v=hook.memoizedState
          if (Array.isArray(v) && v[0]?.actions && v[0]?.mixer) animation=v[0]
          if (Array.isArray(v) && v[0]?.headBase) rig=v[0]
          if (typeof v?.current?.yaw === 'number') gaze=v.current
        }
        walk(node.child); walk(node.sibling)
      }
      walk([..._roots.values()][0].fiber.current)
      const action=animation.actions.Idle
      if (currentMixer !== animation.mixer) {
        currentMixer=animation.mixer
        currentMixer.addEventListener('loop', event => { if(event.action===action) loops+=event.loopDelta })
      }
      referenceMixer.setTime(action.time)
      let maxBodyAngleError=0, maxBodyPositionError=0, maxBodyScaleError=0
      const bodyBones={}
      motion.traverse(bone => {
        if(!bone.isBone) return
        const original=reference.scene.getObjectByName(bone.name)
        if(!['Head_06','Neck_05'].includes(bone.name)) {
          maxBodyAngleError=Math.max(maxBodyAngleError,bone.quaternion.clone().normalize().angleTo(original.quaternion.clone().normalize()))
          maxBodyPositionError=Math.max(maxBodyPositionError,bone.position.distanceTo(original.position))
          maxBodyScaleError=Math.max(maxBodyScaleError,bone.scale.distanceTo(original.scale))
        }
        if(['Spine_02','Spine1_03','LeftForeArm_010','RightForeArm_015','LeftHand_011'].includes(bone.name)) bodyBones[bone.name]=bone.quaternion.toArray()
      })
      const model=motion.children[0]
      model.updateWorldMatrix(true,true)
      model.traverse(node => { if(node.isSkinnedMesh) node.skeleton.update() })
      const box=new THREE.Box3().setFromObject(model,true)
      const camera=instance.root.getState().camera
      const canvas=instance.root.getState().gl.domElement.getBoundingClientRect()
      const upper=box.max.clone().project(camera), lower=box.min.clone().project(camera)
      const renderedTop=canvas.top+(1-upper.y)*canvas.height/2
      const renderedBottom=canvas.top+(1-lower.y)*canvas.height/2
      return {
        now:performance.now(), clip:action.getClip().name, duration:action.getClip().duration,
        time:action.time, elapsed:loops*action.getClip().duration+action.time, loops,
        running:action.isRunning(), paused:action.paused, weight:action.getEffectiveWeight(),
        timeScale:action.getEffectiveTimeScale(), mixerScale:animation.mixer.timeScale,
        repeats:action.repetitions===Infinity?'Infinity':action.repetitions, loop:action.loop,
        yaw:gaze.yaw,pitch:gaze.pitch, bodyBones,
        maxBodyAngleError,maxBodyPositionError,maxBodyScaleError,
        headAnimatedPoseError:rig.headBase.clone().normalize().angleTo(reference.scene.getObjectByName('Head_06').quaternion.clone().normalize()),
        rootQuaternion:motion.quaternion.toArray(), rootPosition:motion.position.toArray(),
        renderedTop,renderedBottom,
        descriptionBottom:document.querySelector('.th-description').getBoundingClientRect().bottom,
        editTop:document.querySelector('.th-edit-avatar').getBoundingClientRect().top,
      }
    }
  })
  const sample = () => page.evaluate(() => window.bodyAnimationSample())
  let previousTime
  for (let i=0;i<10;i++) {
    const point = i<2 ? [-20,400] : [[1,440],[1710,440],[855,1],[855,863]][(i-2)%4]
    await page.mouse.move(...point)
    await page.waitForTimeout(i<2?450:800)
    const s=await sample()
    assert.equal(s.clip,'Idle'); assert.equal(s.repeats,'Infinity'); assert.equal(s.loop,2201)
    assert(s.running); assert.equal(s.weight,1); assert.equal(s.timeScale,1)
    assert.equal(s.mixerScale,1)
    assert(s.maxBodyAngleError<0.00001,JSON.stringify(s))
    assert(s.maxBodyPositionError<0.000001);assert(s.maxBodyScaleError<0.000001)
    assert(s.headAnimatedPoseError<0.00001,'Gaze must retain the current animated head pose')
    assert.deepEqual(s.rootQuaternion,[0,0,0,1]);assert.deepEqual(s.rootPosition,[0,0,0])
    assert(s.renderedTop>s.descriptionBottom);assert(s.renderedBottom<s.editTop)
    if(previousTime!==undefined) assert(s.elapsed>previousTime,'Body clock must keep advancing while tracking')
    previousTime=s.elapsed
    if(i>=2) {
      const direction=(i-2)%4
      if(direction===0) assert(s.yaw<-.35)
      if(direction===1) assert(s.yaw>.35)
      if(direction===2) assert(s.pitch<-.18)
      if(direction===3) assert(s.pitch>.18)
    }
    results.samples.push(s)
    if([0,2,3,4,5,8].includes(i)) await page.screenshot({path:path.join(out,`idle-frame-${i}.png`),clip:{x:735,y:341,width:240,height:343}})
    console.log(`PASS sample ${i}, Idle t=${s.time.toFixed(3)}, loops=${s.loops}, body matches source GLB`)
  }
  const first=results.samples[0], last=results.samples.at(-1)
  const wall=(last.now-first.now)/1000, elapsed=last.elapsed-first.elapsed
  assert(last.loops>=3,'Must verify multiple complete loops')
  assert(Math.abs(elapsed-wall)<.3,`Authored timing changed: ${elapsed} animation seconds vs ${wall} wall seconds`)
  const movement=await page.evaluate(samples=>{
    const q=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0))/(Math.hypot(...a)*Math.hypot(...b))))
    return Object.fromEntries(Object.keys(samples[0].bodyBones).map(name=>[name,Math.max(...samples.map(s=>q(s.bodyBones[name],samples[0].bodyBones[name])))*180/Math.PI]))
  },results.samples)
  assert(movement.Spine_02>1,'Spine must visibly animate')
  assert(movement.LeftForeArm_010>1,'Forearms must visibly animate')
  results.bodyMovementDegrees=movement; results.timing={wallSeconds:wall,animationSeconds:elapsed}
  const beforePause=await sample()
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300)
  const paused=await sample();await page.waitForTimeout(700);const stillPaused=await sample()
  assert(paused.paused);assert.equal(paused.time,stillPaused.time)
  // A preference change must pause at the current phase, never reset to 0.
  assert(paused.elapsed>=beforePause.elapsed-.01 && paused.elapsed-beforePause.elapsed<.3)
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(550)
  const resumed=await sample()
  assert(resumed.elapsed>paused.elapsed+.25 && resumed.elapsed<paused.elapsed+.8)
  results.reducedMotion={beforePause,paused,stillPaused,resumed}
  await page.mouse.move(-20,400);await page.waitForTimeout(1300)
  const neutral=await sample()
  assert(Math.abs(neutral.yaw)<.002 && Math.abs(neutral.pitch)<.002)
  const edit=page.getByRole('button',{name:'Edit Avatar'})
  await edit.click();assert(await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape')
  assert(await edit.evaluate(element=>element===document.activeElement))
  for (const [name,route] of [['Play Solo Challenge yourself','/game/singleplayer'],['Play Together With friends','/duels'],['Compete Climb the leaderboards','/duels']]) {
    assert.equal(await page.getByRole('link',{name}).getAttribute('href'),route)
  }
  await page.screenshot({path:path.join(out,'home-1711x864.png')})
  assert.equal(results.errors.length,0)
  results.passed=true
} finally {
  await context.close()
  await video.saveAs(path.join(out,'idle-and-head-tracking.webm'))
  await fs.rm(await video.path(), { force:true })
  await browser.close()
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(results,null,2))
}
console.log('PASS original body animation, original timing, multiple loops, additive head tracking and pause/resume')
