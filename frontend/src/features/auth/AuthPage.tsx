import { useState } from 'react';
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
type AuthView = 'chooser' | 'form';

interface AuthPageProps {
  googleAvailable: boolean;
  recoveryAvailable: boolean;
  resetToken?: string | null;
  onAuthenticated: (user: AuthUser) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not complete the request. Try again.';
}

/**
 * Dedicated /auth route — replaces the old modal dialog so sign-in has a real,
 * shareable URL. The provider chooser (Google / "Continue with Email") is the
 * first screen; the pre-existing email/password form sits one level deeper,
 * unchanged in behavior.
 */
export function AuthPage({ googleAvailable, recoveryAvailable, resetToken = null, onAuthenticated }: AuthPageProps) {
  const [view, setView] = useState<AuthView>(resetToken ? 'form' : 'chooser');
  const [intent, setIntent] = useState<'login' | 'register'>('login');
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  function openEmailForm(nextIntent: 'login' | 'register') {
    setIntent(nextIntent);
    setMode(nextIntent);
    setStatus('idle');
    setError(null);
    setView('form');
  }

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
    <section className="tg-auth-page">
      <div className="tg-auth-page-bg" aria-hidden="true" />
      <div className="tg-auth-page-overlay" aria-hidden="true" />
      <div className="tg-auth-page-content">
        <section className="tg-auth-card tg-panel" aria-labelledby="auth-title">
          {view === 'chooser' ? (
            <>
              <div className="tg-eyebrow">Your next expedition starts here</div>
              <h2 id="auth-title">{intent === 'register' ? 'Sign up to play' : 'Log in to play'}</h2>
              <p className="tg-muted">Sign in to keep your TerraGuessr profile and games together.</p>
              <div className="tg-auth-chooser">
                <a
                  className={`tg-button tg-auth-provider tg-auth-provider-google${googleAvailable ? '' : ' is-disabled'}`}
                  href={googleAvailable ? '/api/auth/google' : undefined}
                  aria-disabled={!googleAvailable}
                  onClick={(event) => { if (!googleAvailable) event.preventDefault(); }}
                >
                  <span aria-hidden="true" className="tg-google-mark">G</span> Continue with Google
                </a>
                {!googleAvailable ? <p className="tg-auth-note">Google sign-in needs OAuth client settings from the site operator.</p> : null}
                <button type="button" className="tg-button tg-auth-provider tg-auth-provider-email" onClick={() => openEmailForm(intent)}>
                  Continue with Email
                </button>
              </div>
              <div className="tg-auth-switch">
                {intent === 'register' ? (
                  <>Already have an account? <button type="button" onClick={() => setIntent('login')}>Log in</button></>
                ) : (
                  <>{"Don't have an account?"} <button type="button" onClick={() => setIntent('register')}>Sign up</button></>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="tg-eyebrow">Your next expedition starts here</div>
              <h2 id="auth-title">{title}</h2>
              <p className="tg-muted">Sign in to keep your TerraGuessr profile and games together.</p>
              {status === 'done' ? <p role="status" className="tg-auth-success">Password updated. Sign in with your new password.</p> : null}
              {status === 'sent' ? <p role="status" className="tg-auth-success">If this address has a TerraGuessr account, recovery instructions have been sent.</p> : null}
              <form onSubmit={(event) => void submit(event)} className="tg-auth-form">
                {mode === 'register' ? <label>Display name<input autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></label> : null}
                {mode !== 'reset' ? <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label> : null}
                {mode === 'login' || mode === 'register' || mode === 'reset' ? <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required /><small>Use at least 12 characters.</small></label> : null}
                {error ? <p role="alert" className="tg-auth-error">{error}</p> : null}
                {mode !== 'forgot' || status !== 'sent' ? <button className="tg-button tg-button-primary" type="submit" disabled={status === 'busy' || (mode === 'forgot' && !recoveryAvailable)}>{status === 'busy' ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send recovery email' : mode === 'reset' ? 'Save new password' : 'Sign in'}</button> : null}
              </form>
              {mode === 'login' ? (
                <div className="tg-auth-links">
                  <button type="button" onClick={() => { setMode('forgot'); setStatus('idle'); setError(null); }}>Forgot password?</button>
                  <button type="button" onClick={() => { setMode('register'); setStatus('idle'); setError(null); }}>Create an account</button>
                </div>
              ) : mode !== 'reset' ? (
                <div className="tg-auth-links">
                  <button type="button" onClick={() => { setMode('login'); setStatus('idle'); setError(null); }}>Back to sign in</button>
                </div>
              ) : null}
              {mode === 'forgot' && !recoveryAvailable ? <p className="tg-auth-note">Recovery email is unavailable until an email provider is configured.</p> : null}
              {!resetToken ? (
                <button type="button" className="tg-button tg-button-quiet tg-auth-back" onClick={() => setView('chooser')}>← Back</button>
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  );
}

export default AuthPage;
