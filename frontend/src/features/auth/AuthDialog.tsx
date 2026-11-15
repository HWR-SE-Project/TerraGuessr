import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../../api/client';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  hasGoogle: boolean;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
interface AuthDialogProps {
  open: boolean;
  googleAvailable: boolean;
  recoveryAvailable: boolean;
  resetToken?: string | null;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not complete the request. Try again.';
}

export function AuthDialog({
  open,
  googleAvailable,
  recoveryAvailable,
  resetToken = null,
  onClose,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'busy') return;
    setStatus('busy');
    setError(null);
    try {
      if (mode === 'login' || mode === 'register') {
        const result = mode === 'login'
          ? await apiFetch<{ user: AuthUser }>('/auth/login', { method: 'POST', body: { email, password } })
          : await apiFetch<{ user: AuthUser }>('/auth/register', { method: 'POST', body: { email, password, displayName } });
        onAuthenticated(result.user);
        onClose();
        return;
      }
      if (mode === 'forgot') {
        await apiFetch<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: { email } });
        setStatus('sent');
        return;
      }
      if (!resetToken) throw new Error('This password reset link is incomplete. Request a new link.');
      await apiFetch<void>('/auth/password-reset/complete', { method: 'POST', body: { token: resetToken, password } });
      setMode('login');
      setPassword('');
      setStatus('done');
      return;
    } catch (cause) {
      setError(errorText(cause));
    }
    setStatus('idle');
  }

  const title = mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Recover your account' : mode === 'reset' ? 'Choose a new password' : 'Welcome back';
  return (
    <div className="tg-auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="tg-auth-card tg-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="tg-auth-close" onClick={onClose} aria-label="Close sign in">×</button>
        <div className="tg-eyebrow">Your next expedition starts here</div>
        <h2 id="auth-title">{title}</h2>
        <p className="tg-muted">Sign in to keep your TerraGuessr profile and games together.</p>
        {mode === 'login' || mode === 'register' ? (
          <>
            <a className={`tg-button tg-google-button${googleAvailable ? '' : ' is-disabled'}`} href={googleAvailable ? '/api/auth/google' : undefined} aria-disabled={!googleAvailable} onClick={(event) => { if (!googleAvailable) event.preventDefault(); }}>
              <span aria-hidden="true" className="tg-google-mark">G</span> Continue with Google
            </a>
            {!googleAvailable ? <p className="tg-auth-note">Google sign-in needs OAuth client settings from the site operator.</p> : null}
            <div className="tg-auth-divider"><span>or use email</span></div>
          </>
        ) : null}
        {status === 'done' ? <p role="status" className="tg-auth-success">Password updated. Sign in with your new password.</p> : null}
        {status === 'sent' ? <p role="status" className="tg-auth-success">If this address has a TerraGuessr account, recovery instructions have been sent.</p> : null}
        <form onSubmit={(event) => void submit(event)} className="tg-auth-form">
          {mode === 'register' ? <label>Display name<input autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></label> : null}
          {mode !== 'reset' ? <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label> : null}
          {mode === 'login' || mode === 'register' || mode === 'reset' ? <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required /><small>Use at least 12 characters.</small></label> : null}
          {error ? <p role="alert" className="tg-auth-error">{error}</p> : null}
          {mode !== 'forgot' || status !== 'sent' ? <button className="tg-button tg-button-primary" type="submit" disabled={status === 'busy' || (mode === 'forgot' && !recoveryAvailable)}>{status === 'busy' ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send recovery email' : mode === 'reset' ? 'Save new password' : 'Sign in'}</button> : null}
        </form>
        {mode === 'login' ? <div className="tg-auth-links"><button type="button" onClick={() => { setMode('forgot'); setStatus('idle'); setError(null); }}>Forgot password?</button><button type="button" onClick={() => { setMode('register'); setStatus('idle'); setError(null); }}>Create an account</button></div> : mode !== 'reset' ? <div className="tg-auth-links"><button type="button" onClick={() => { setMode('login'); setStatus('idle'); setError(null); }}>Back to sign in</button></div> : null}
        {mode === 'forgot' && !recoveryAvailable ? <p className="tg-auth-note">Recovery email is unavailable until an email provider is configured.</p> : null}
      </section>
    </div>
  );
}
