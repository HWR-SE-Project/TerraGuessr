import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthUser } from './AuthPage';
import { apiFetch } from '../../api/client';

interface AccountPagesProps {
  page: 'profile' | 'settings';
  user: AuthUser;
  onBack: () => void;
  onDeleted: () => void;
  onProfileUpdated: (displayName: string) => void;
  onLanguageChange: (language: 'en' | 'de') => void;
}

interface Preferences {
  language: 'en' | 'de';
  soundFxVolume: number;
  musicVolume: number;
  fullscreen: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { language: 'en', soundFxVolume: 50, musicVolume: 35, fullscreen: false };

export function AccountPages({ page, user, onBack, onDeleted, onProfileUpdated, onLanguageChange }: AccountPagesProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [dailyStreak, setDailyStreak] = useState({ current: 0, longest: 0 });
  const [confirmation, setConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ preferences: Preferences | null; dailyStreak?: { current: number; longest: number } }>('/auth/session').then((result) => {
      const saved = { ...DEFAULT_PREFERENCES, ...result.preferences };
      setPreferences(saved);
      setDailyStreak(result.dailyStreak ?? { current: 0, longest: 0 });
      onLanguageChange(saved.language);
    }).catch(() => setError('Could not load your saved preferences.'));
  }, [page, onLanguageChange]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    try {
      const saved = displayName.trim();
      await apiFetch('/auth/profile', { method: 'PATCH', body: { displayName: saved } });
      onProfileUpdated(saved);
      setMessage('Display name updated.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update your profile.'); }
    setSaving(false);
  }

  async function removeAccount() {
    if (confirmation !== 'DELETE') return;
    setSaving(true); setError(null);
    try {
      await apiFetch('/auth/account', { method: 'DELETE', body: { confirmation, ...(user.hasPassword ? { currentPassword } : {}) } });
      onDeleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete your account.'); }
    setSaving(false);
  }

  async function changeFullscreen(enabled: boolean) {
    setSaving(true); setError(null); setMessage(null);
    try {
      if (enabled && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (!enabled && document.fullscreenElement) await document.exitFullscreen();
      const result = await apiFetch<{ preferences: Preferences }>('/auth/preferences', {
        method: 'PATCH', body: { fullscreen: enabled },
      });
      setPreferences({ ...DEFAULT_PREFERENCES, ...result.preferences });
      setMessage('Preference saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Fullscreen is unavailable in this browser.'); }
    setSaving(false);
  }

  async function changeLanguage(language: 'en' | 'de') {
    setSaving(true); setError(null); setMessage(null);
    try {
      const result = await apiFetch<{ preferences: Preferences }>('/auth/preferences', { method: 'PATCH', body: { language } });
      setPreferences({ ...DEFAULT_PREFERENCES, ...result.preferences });
      onLanguageChange(language);
      setMessage(language === 'de' ? 'Sprache gespeichert.' : 'Language saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save language.'); }
    setSaving(false);
  }

  const de = preferences.language === 'de';

  return (
    <section className="tg-account-page tg-panel" aria-labelledby="account-page-heading">
      <button className="tg-button tg-button-quiet" type="button" onClick={onBack}>← {de ? 'Zurück' : 'Back'}</button>
      {page === 'profile' ? (
        <>
          <div className="tg-eyebrow tg-mt-6">Your player identity</div>
          <h1 id="account-page-heading">{de ? 'Profil' : 'Profile'}</h1>
          <div className="tg-account-facts"><div><span>{de ? 'E-Mail' : 'Email'}</span><strong>{user.email}</strong></div><div><span>{de ? 'Verknüpfte Anmeldung' : 'Connected sign-in'}</span><strong>{[user.hasPassword ? 'Email' : null, user.hasGoogle ? 'Google' : null].filter(Boolean).join(' · ')}</strong></div><div><span>{de ? 'Aktuelle tägliche Serie' : 'Current daily streak'}</span><strong>{dailyStreak.current} {de ? 'Tage' : 'days'}</strong></div><div><span>{de ? 'Längste tägliche Serie' : 'Longest daily streak'}</span><strong>{dailyStreak.longest} {de ? 'Tage' : 'days'}</strong></div><div><span>{de ? 'Mitglied seit' : 'Member since'}</span><strong>{new Date(user.createdAt).toLocaleDateString(de ? 'de-DE' : 'en-US')}</strong></div></div>
          <form className="tg-account-form" onSubmit={(event) => void saveProfile(event)}><label>{de ? 'Anzeigename' : 'Display name'}<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></label><button className="tg-button tg-button-primary" disabled={saving}>{de ? 'Namen speichern' : 'Save name'}</button></form>
          <section className="tg-danger-zone"><div className="tg-eyebrow tg-eyebrow-danger">{de ? 'Konto löschen' : 'Account deletion'}</div><p>{de ? 'Beim Löschen werden E-Mail-Identität, Anmeldemethoden, gespeicherte Einstellungen und aktive Sitzungen entfernt. Abgeschlossene Spiele und Ergebnisse bleiben gemäß der bestehenden sechsmonatigen Aufbewahrung anonymisiert erhalten.' : 'Deleting removes your email identity, sign-in methods, saved preferences, and active sessions. Completed games and results remain anonymized for the existing six-month retention period.'}</p>
            {!deleting ? <button type="button" className="tg-button tg-delete-button" onClick={() => setDeleting(true)}>{de ? 'Konto löschen…' : 'Delete account…'}</button> : <div className="tg-delete-confirm"><label>{de ? 'Zur Bestätigung DELETE eingeben' : 'Type DELETE to confirm'}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{user.hasPassword ? <label>{de ? 'Aktuelles Passwort' : 'Current password'}<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label> : null}<div className="tg-form-actions"><button className="tg-button tg-button-quiet" type="button" onClick={() => setDeleting(false)}>{de ? 'Abbrechen' : 'Cancel'}</button><button className="tg-button tg-delete-button" type="button" disabled={saving || confirmation !== 'DELETE' || (user.hasPassword && currentPassword.length < 12)} onClick={() => void removeAccount()}>{saving ? (de ? 'Wird gelöscht…' : 'Deleting…') : (de ? 'Dauerhaft löschen' : 'Permanently delete')}</button></div></div>}
          </section>
        </>
      ) : (
        <>
          <div className="tg-eyebrow tg-mt-6">Personalize your game</div>
          <h1 id="account-page-heading">{de ? 'Einstellungen' : 'Settings'}</h1>
          <div className="tg-setting-row"><div><strong>{de ? 'Vollbild' : 'Fullscreen'}</strong><p>{de ? 'Nutze beim Erkunden den gesamten Bildschirm.' : 'Use the whole display while exploring.'}</p></div><button type="button" className={`tg-switch${preferences.fullscreen ? ' is-on' : ''}`} role="switch" aria-checked={preferences.fullscreen} disabled={saving} onClick={() => void changeFullscreen(!preferences.fullscreen)}><span /></button></div>
          <div className="tg-setting-row"><div><strong>{de ? 'Sprache' : 'Language'}</strong><p>{de ? 'Sprache der Benutzeroberfläche ändern.' : 'Change interface language.'}</p></div><select aria-label={de ? 'Sprache' : 'Language'} value={preferences.language} disabled={saving} onChange={(event) => void changeLanguage(event.target.value as 'en' | 'de')}><option value="en">English</option><option value="de">Deutsch</option></select></div>
          <p className="tg-muted tg-settings-note">{de ? 'Audio-Steuerung wird angezeigt, sobald TerraGuessr echte Soundeffekte und Musik abspielt.' : 'Sound controls will appear when TerraGuessr has actual sound effects and music playback.'}</p>
        </>
      )}
      {error ? <p className="tg-auth-error" role="alert">{error}</p> : null}{message ? <p className="tg-auth-success" role="status">{message}</p> : null}
    </section>
  );
}
