import { useEffect } from 'react'
import { createStore, useStore } from '../lib/store'
import type { GameRulesCatalog } from '../lib/contracts'
import { api } from '../services'

const store = createStore<GameRulesCatalog | null>(null)
let pending: Promise<void> | null = null

export function useGameRules() {
  useEffect(() => {
    if (pending || store.get()) return
    pending = api.gameRules().then((rules) => store.set(rules)).catch(() => {}).finally(() => {
      pending = null
    })
  }, [])
  return useStore(store)
}
