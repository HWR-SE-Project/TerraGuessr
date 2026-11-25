import { describe, expect, it } from 'vitest'
import { AnimationClip, AnimationMixer, Bone, Group, NumberKeyframeTrack } from 'three'
import { ExplorerPlayback } from './explorerPlayback'

describe('explorer clip transitions', () => {
  it('preserves an interrupted blend and restores even bones omitted from Walk', () => {
    const model = new Group()
    const arm = new Bone()
    const shoulder = new Bone()
    arm.name = 'Arm'
    shoulder.name = 'Shoulder'
    model.add(shoulder)
    shoulder.add(arm)
    const mixer = new AnimationMixer(model)
    const track = (name: string, value: number) =>
      new NumberKeyframeTrack(name + '.rotation[x]', [0, 1], [value, value])
    const actions = {
      Idle: mixer.clipAction(new AnimationClip('Idle', 1, [track('Arm', 0.12), track('Shoulder', 0.23)])),
      Walk: mixer.clipAction(new AnimationClip('Walk', 1, [track('Arm', -0.4)])),
      Jump: mixer.clipAction(new AnimationClip('Jump', 1, [track('Arm', 0.9), track('Shoulder', -0.7)])),
    }
    const playback = new ExplorerPlayback(actions)
    const tick = (dt: number) => {
      playback.advance(dt)
      mixer.update(dt)
      const weights = Object.values(actions).map(action => action.isScheduled() ? action.getEffectiveWeight() : 0)
      expect(weights.reduce((sum, weight) => sum + weight)).toBeCloseTo(1, 6)
    }
    tick(0)
    playback.play('Walk')
    tick(0.08)
    const beforeClick = arm.rotation.x
    playback.play('Jump')
    tick(0)
    expect(arm.rotation.x).toBeCloseTo(beforeClick, 6)
    tick(0.2)
    tick(1)
    expect(actions.Jump.paused).toBe(true)
    playback.play('Idle')
    tick(0.2)
    expect(actions.Walk.isScheduled()).toBe(false)
    expect(actions.Jump.isScheduled()).toBe(false)
    expect(arm.rotation.x).toBeCloseTo(0.12)
    expect(shoulder.rotation.x).toBeCloseTo(0.23)
  })
})
