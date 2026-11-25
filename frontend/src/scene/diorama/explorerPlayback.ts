import { LoopOnce, LoopRepeat, MathUtils } from 'three'
import type { AnimationAction } from 'three'

const CLIPS = ['Idle', 'Walk', 'Jump'] as const
type Clip = typeof CLIPS[number]
const BLEND_SECONDS = 0.2

// An interrupted fade starts at the weights actually on screen. Three's
// fadeOut() starts at full weight, even if its fadeIn() was only half done.
export class ExplorerPlayback {
  private current: Clip = 'Idle'
  private elapsed = BLEND_SECONDS
  private readonly from = { Idle: 1, Walk: 0, Jump: 0 }

  private readonly actions: Record<Clip, AnimationAction>

  constructor(actions: Record<Clip, AnimationAction>) {
    this.actions = actions
    for (const clip of CLIPS) actions[clip].stop()
    actions.Idle.reset().setEffectiveWeight(1).play()
  }

  play(clip: Clip) {
    if (clip === this.current) return
    for (const key of CLIPS) {
      const action = this.actions[key]
      this.from[key] = action.isScheduled() ? action.getEffectiveWeight() : 0
    }
    this.current = clip
    this.elapsed = 0
    const next = this.actions[clip]
    if (clip === 'Jump' || !next.isScheduled()) next.reset()
    next.clampWhenFinished = clip === 'Jump'
    next.setLoop(clip === 'Jump' ? LoopOnce : LoopRepeat, clip === 'Jump' ? 1 : Infinity)
    next.setEffectiveWeight(this.from[clip]).play()
  }

  advance(delta: number) {
    if (this.elapsed >= BLEND_SECONDS) return
    this.elapsed = Math.min(this.elapsed + delta, BLEND_SECONDS)
    const blend = MathUtils.smoothstep(this.elapsed, 0, BLEND_SECONDS)
    for (const clip of CLIPS) {
      const action = this.actions[clip]
      if (!action.isScheduled()) continue
      if (blend === 1 && clip !== this.current) action.stop()
      else action.setEffectiveWeight(MathUtils.lerp(this.from[clip], Number(clip === this.current), blend))
    }
  }
}
