import { describe, expect, it } from 'vitest'
import { createStore } from './store'

describe('createStore', () => {
  it('returns the initial value and updates immutably', () => {
    const store = createStore(0)
    expect(store.get()).toBe(0)
    store.set(1)
    expect(store.get()).toBe(1)
  })

  it('supports functional updates', () => {
    const store = createStore<number[]>([])
    store.set((prev) => [...prev, 1])
    store.set((prev) => [...prev, 2])
    expect(store.get()).toEqual([1, 2])
  })

  it('skips identical values', () => {
    const store = createStore('a')
    let notifications = 0
    store.subscribe(() => notifications++)
    store.set('a')
    expect(notifications).toBe(0)
  })

  it('notifies subscribers and allows unsubscription', () => {
    const store = createStore(0)
    let notifications = 0
    const unsubscribe = store.subscribe(() => notifications++)
    store.set(1)
    store.set(2)
    unsubscribe()
    store.set(3)
    expect(notifications).toBe(2)
  })
})
