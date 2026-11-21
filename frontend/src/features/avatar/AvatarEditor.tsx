import { Dialog } from '../../components/ui/Dialog'
import { IconButton } from '../../components/ui/IconButton'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_AVATAR } from './avatarConfig'
import type { AvatarConfig } from './avatarConfig'
import { AvatarCustomizationPanel } from './AvatarCustomizationPanel'
import { CATEGORIES } from './avatarCategories'
import type { AvatarCategory } from './avatarCategories'
import type { PreviewCommand } from './AvatarPreview'
import { Button } from '../../components/ui/Button'
import './AvatarEditor.css'

const AvatarPreview = lazy(() => import('./AvatarPreview').then(module => ({ default: module.AvatarPreview })))
export function AvatarEditor({ initialConfig, account, loading, loadError, onRetry, onSave, onClose }: {
  initialConfig: AvatarConfig; account: boolean; loading: boolean; loadError: string
  onRetry: () => void; onSave: (config: AvatarConfig) => Promise<void>; onClose: (saved: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(loading ? { ...DEFAULT_AVATAR } : initialConfig)
  const [category, setCategory] = useState<AvatarCategory>('hair')
  const [command, setCommand] = useState<PreviewCommand>({ id: 0, action: 'reset' })
  const [ready, setReady] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const onReady = useCallback(() => setReady(true), [])
  const onPreviewError = useCallback(() => { setPreviewError(true); setReady(false) }, [])
  // Loading finishes before controls become available. Never replace an edited draft.
  // Synchronize the asynchronously loaded saved configuration.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { if (!loading) setDraft(initialConfig) }, [loading, initialConfig])
  const close = (saved: boolean) => {
    // Remove native modal inertness before Home restores focus to Edit Avatar.
    dialog.current?.close()
    onClose(saved)
  }
  const cancel = () => { if (!pending.current) close(false) }
  const save = async () => {
    if (pending.current || !ready || loading || previewError) return
    pending.current = true
    setSaving(true)
    setError('')
    try { await onSave(draft); close(true) }
    catch { setError(account ? 'Could not sync your avatar. Your changes are still here. Please try saving again.' : 'Could not save on this device. Check browser storage and try again.') }
    finally { pending.current = false; setSaving(false) }
  }
  const cameraAction = (action: PreviewCommand['action']) => setCommand(previous => ({ id: previous.id + 1, action }))
  return <Dialog ref={dialog} className="ae-dialog tg-glass" aria-labelledby="ae-title"
    onClose={cancel} closeDisabled={saving}>
    <div className="ae-shell">
      <header className="ae-header">
        <div><span className="ae-eyebrow">EXPLORER STUDIO</span><h2 id="ae-title">A world of <em>you.</em></h2></div>
        <IconButton className="ae-icon-button" aria-label="Close avatar editor" onClick={cancel} disabled={saving} autoFocus>×</IconButton>
      </header>
      <div className="ae-body">
        <aside className="ae-customization">
          <nav className="ae-categories" aria-label="Avatar categories">
            {CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} aria-controls="ae-options" onClick={() => setCategory(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
            <button type="button" disabled title="No accessories are available for this explorer"><span aria-hidden="true">◇</span>Extras<small>Unavailable</small></button>
          </nav>
          <fieldset className="ae-controls-fieldset" disabled={loading || saving || previewError}>
            <AvatarCustomizationPanel category={category} config={draft} onChange={(part, color) => setDraft(previous => ({ ...previous, [part]: color }))} />
          </fieldset>
        </aside>
        <section className="ae-preview" aria-label="Avatar preview">
          <div className="ae-preview-badge"><span /> LIVE PREVIEW</div>
          <div className="ae-preview-orbit" aria-hidden="true" />
          <div className="ae-canvas">
            <Suspense fallback={null}><AvatarPreview config={draft} command={command} onReady={onReady} onError={onPreviewError} /></Suspense>
          </div>
          {!ready && !previewError && <p className="ae-loading" role="status">Getting your explorer ready…</p>}
          {previewError && <p className="ae-preview-error" role="alert">Preview unavailable. Close the editor and try again.</p>}
          <div className="ae-camera-controls" role="group" aria-label="Preview camera controls">
            <button type="button" aria-label="Rotate left" onClick={() => cameraAction('left')}>↶</button>
            <button type="button" aria-label="Rotate right" onClick={() => cameraAction('right')}>↷</button>
            <span />
            <button type="button" aria-label="Zoom out" onClick={() => cameraAction('out')}>−</button>
            <button type="button" aria-label="Zoom in" onClick={() => cameraAction('in')}>+</button>
            <button type="button" aria-label="Reset camera" onClick={() => cameraAction('reset')}>⌖</button>
          </div>
          <p className="ae-preview-hint">Drag to turn · Pinch or scroll to zoom</p>
        </section>
      </div>
      <footer className="ae-footer">
        <div className="ae-feedback" aria-live="polite">{loadError ? <p role="alert">{loadError} <button type="button" onClick={onRetry}>Retry</button></p> : error ? <p role="alert">{error}</p> : loading ? <p>Loading saved appearance…</p> : null}</div>
        <div className="ae-actions">
          <Button variant="ghost" className="ae-reset" aria-label="Reset to Default" onClick={() => { setDraft({ ...DEFAULT_AVATAR }); setError('') }} disabled={saving || loading}>↺ <span>Reset to Default</span></Button>
          <Button variant="secondary" className="ae-cancel" onClick={cancel} disabled={saving}>Cancel</Button>
          <Button className="ae-save" onClick={save} disabled={saving || loading || !ready || previewError}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </footer>
    </div>
  </Dialog>
}
