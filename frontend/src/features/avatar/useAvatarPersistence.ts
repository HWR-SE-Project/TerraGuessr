import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../../state/SessionContext'
import { DEFAULT_AVATAR } from './avatarConfig'
import type { AvatarConfig } from './avatarConfig'
import { loadAvatar, publishAvatar, saveAvatar, useSavedAvatar } from './avatarConfigService'

export function useAvatarPersistence() {
  const { user, status } = useSession()
  const identity = status === 'loading' ? 'loading' : user?.id ?? 'guest'
  const currentIdentity = useRef(identity)
  useEffect(() => {
    currentIdentity.current = identity
    return () => { currentIdentity.current = 'disposed' }
  }, [identity])
  const config = useSavedAvatar()
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    publishAvatar({ ...DEFAULT_AVATAR })
    if (identity === 'loading') return
    loadAvatar(identity !== 'guest').then(value => {
      if (!active) return
      publishAvatar(value)
      setLoadedIdentity(identity)
      setError('')
    }).catch(() => {
      if (active) setError('Your saved appearance could not be loaded. Try again before editing.')
    })
    return () => { active = false }
  }, [identity, attempt])
  const save = useCallback(async (draft: AvatarConfig) => {
    if (loadedIdentity !== identity) throw new Error('Wait for your saved avatar to load.')
    const result = await saveAvatar(draft, identity !== 'guest')
    if (currentIdentity.current !== identity) throw new Error('Your account changed. Reopen the editor to continue.')
    publishAvatar(result)
  }, [identity, loadedIdentity])
  return { config, save, identity, account: !!user, loading: loadedIdentity !== identity,
    error, retry: () => { setError(''); setAttempt(value => value + 1) } }
}
