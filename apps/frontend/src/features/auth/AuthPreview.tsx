import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { authRoute, requestedWorkspace } from '../auth-routing';
import { EntryThemeControl } from './EntryAppearance';
import { OtpCodeInput } from './OtpCodeInput';
import { ResendCodeButton } from './ResendCodeButton';
import { sessionKey } from './session';

export interface AuthPreviewProps {
  mode: 'login' | 'register';
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="DevUP home">
      <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="13" fill="#245bc9" />
        <path
          d="m11 21 13-10 13 10M11 33l13-10 13 10"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>DevUP</span>
    </a>
  );
}

export function AuthPreview({ mode: initialMode }: AuthPreviewProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(initialMode);
  const signingUp = currentMode === 'register';

  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form input states for validation
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 2FA challenge states
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorNotice, setTwoFactorNotice] = useState('');

  const destination = requestedWorkspace();

  // URL alerts
  const [notice, setNotice] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setCurrentMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('passwordChanged') === '1') {
      setNotice({
        type: 'success',
        text: 'Your password has been changed. Please sign in with your new password.',
      });
    } else if (params.get('resetSuccess') === '1') {
      setNotice({
        type: 'success',
        text: 'Password reset successful! Sign in with your new password.',
      });
    } else if (params.get('verified') === '1') {
      setNotice({ type: 'success', text: 'Email verified! Sign in to access your workspace.' });
    }
  }, []);

  function switchMode(newMode: 'login' | 'register') {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
    setErrorMessage('');
    window.history.pushState(
      null,
      '',
      authRoute(newMode === 'login' ? '/login' : '/register', destination),
    );
  }

  const isPasswordValid = password.length >= 8;
  const isUsernameValid = username.trim().length >= 3 && username.trim().length <= 30;

  async function handleTwoFactorSubmit(codeToVerify?: string) {
    const code = (codeToVerify || twoFactorCode).trim();
    if (code.length !== 6 || twoFactorPending) return;

    setTwoFactorPending(true);
    setErrorMessage('');
    setTwoFactorNotice('');

    try {
      const response = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorToken, code }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.accessToken) {
        const detail = result?.message;
        setErrorMessage(
          Array.isArray(detail)
            ? detail.join(' ')
            : detail || 'Invalid or expired 2FA code. Please check and try again.',
        );
        return;
      }

      sessionStorage.setItem(sessionKey, result.accessToken);
      const onboarding = new URLSearchParams(window.location.search).get('onboarding') === '1';
      window.location.replace(onboarding ? authRoute('/onboarding', destination) : destination);
    } catch {
      setErrorMessage('Could not verify 2FA code. Please check your connection and try again.');
    } finally {
      setTwoFactorPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (signingUp) {
      if (!isUsernameValid) {
        setErrorMessage('Username must be between 3 and 30 characters.');
        return;
      }
      if (!isPasswordValid) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
    }

    setPending(true);
    setErrorMessage('');

    try {
      const payload = signingUp
        ? { username: username.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const response = await fetch(`/api/auth/${currentMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (
        !response.ok ||
        (signingUp ? !result?.id : !result?.accessToken && !result?.twoFactorRequired)
      ) {
        const detail = result?.message;
        setErrorMessage(
          response.status >= 500
            ? 'Authentication is temporarily unavailable. Please try again later.'
            : Array.isArray(detail)
              ? detail.join(' ')
              : detail ||
                (signingUp ? 'Unable to create your account.' : 'Invalid email or password.'),
        );
        return;
      }

      if (!signingUp) {
        if (result.twoFactorRequired && result.twoFactorToken) {
          setTwoFactorToken(result.twoFactorToken);
          setTwoFactorEmail(email.trim());
          setTwoFactorStep(true);
          setTwoFactorCode('');
          setErrorMessage('');
          setTwoFactorNotice('');
          return;
        }

        sessionStorage.setItem(sessionKey, result.accessToken);
        const onboarding = new URLSearchParams(window.location.search).get('onboarding') === '1';
        window.location.replace(onboarding ? authRoute('/onboarding', destination) : destination);
        return;
      }

      // Automatically sign in after registration
      try {
        const login = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const credentials = await login.json().catch(() => null);
        if (login.ok && typeof credentials?.accessToken === 'string' && credentials.accessToken) {
          sessionStorage.setItem(sessionKey, credentials.accessToken);
          // Redirect to onboarding (avatar then email verification)
          window.location.replace(authRoute('/onboarding', destination));
          return;
        }
      } catch {
        // Fall back to completion message
      }

      setComplete(true);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void import('canvas-confetti')
          .then(({ default: confetti }) =>
            confetti({
              particleCount: 52,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#245bc9', '#3b82f6', '#a855f7', '#10be6c'],
              disableForReducedMotion: true,
            }),
          )
          .catch(() => {});
      }
    } catch {
      setErrorMessage('Could not connect to DevUP. Please check your network connection.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Brand />
        <div className="entry-header-actions">
          <EntryThemeControl />
          <a className="auth-close" href="/" aria-label="Back to DevUP home">
            <X size={20} aria-hidden="true" />
          </a>
        </div>
      </header>

      <section className="auth-shell" aria-labelledby="auth-title">
        <div className="auth-header-copy">
          <h1 id="auth-title">
            {twoFactorStep
              ? 'Verify your sign-in'
              : complete
                ? 'Account created!'
                : signingUp
                  ? 'Join DevUP'
                  : 'Welcome back'}
          </h1>
          {twoFactorStep ? (
            <p className="auth-description">
              Enter the 6-digit verification code sent to{' '}
              <strong>{twoFactorEmail || 'your email'}</strong> to sign in.
            </p>
          ) : !complete ? (
            <p className="auth-description">
              {signingUp
                ? 'Your team’s work, together in one place.'
                : 'Enter your credentials to access your workspaces.'}
            </p>
          ) : null}
        </div>

        <div className="auth-panel">
          {/* Status / Alert Notices */}
          {twoFactorNotice && !errorMessage && (
            <div className="auth-alert auth-alert--success" role="status">
              <Check size={18} aria-hidden="true" />
              <span>{twoFactorNotice}</span>
            </div>
          )}

          {notice && !errorMessage && !complete && !twoFactorStep && (
            <div className={`auth-alert auth-alert--${notice.type}`} role="status">
              <Check size={18} aria-hidden="true" />
              <span>{notice.text}</span>
            </div>
          )}

          {errorMessage && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {twoFactorStep ? (
            <div className="auth-form" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'rgba(36, 91, 201, 0.12)',
                    color: '#245bc9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={32} />
                </div>
              </div>

              <OtpCodeInput
                value={twoFactorCode}
                onChange={setTwoFactorCode}
                onComplete={(code) => void handleTwoFactorSubmit(code)}
                disabled={twoFactorPending}
                hasError={Boolean(errorMessage)}
                autoFocus
              />

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
                <ResendCodeButton
                  storageKey={`devup_2fa_resend_${twoFactorToken.slice(-8)}`}
                  cooldownSeconds={60}
                  onResend={async () => {
                    const res = await fetch('/api/auth/login/2fa/resend', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ twoFactorToken }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => null);
                      throw new Error(err?.message || 'Could not resend 2FA code.');
                    }
                    setErrorMessage('');
                    setTwoFactorNotice('A fresh verification code has been sent to your email.');
                  }}
                />
              </div>

              <button
                className="button button--primary auth-submit"
                type="button"
                disabled={twoFactorPending || twoFactorCode.length !== 6}
                onClick={() => void handleTwoFactorSubmit(twoFactorCode)}
                style={{ marginTop: '1.25rem' }}
              >
                {twoFactorPending ? (
                  <span className="auth-loading-state">
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Verifying…</span>
                  </span>
                ) : (
                  <span>Verify & Sign in</span>
                )}
              </button>

              <button
                type="button"
                className="auth-switch-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  marginTop: '1.25rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setTwoFactorStep(false);
                  setTwoFactorCode('');
                  setTwoFactorToken('');
                  setErrorMessage('');
                  setTwoFactorNotice('');
                }}
              >
                <ArrowLeft size={14} /> Back to email & password
              </button>
            </div>
          ) : complete ? (
            <div className="auth-success-card" role="status">
              <div className="auth-success-icon" aria-hidden="true">
                <Check size={28} />
              </div>
              <h2>Account created!</h2>
              <p>Your DevUP account is ready. Sign in to start collaborating.</p>
              <a
                className="button button--primary auth-submit"
                href={authRoute('/login', destination) + '&onboarding=1'}
              >
                Sign in to your account
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {signingUp && (
                <div className="auth-field">
                  <label htmlFor="auth-username">
                    <span>Username</span>
                    <span className="auth-field-hint">3–30 characters</span>
                  </label>
                  <div className="auth-input-wrap">
                    <User size={18} className="auth-input-icon" aria-hidden="true" />
                    <input
                      id="auth-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. alexdev"
                      required
                      minLength={3}
                      maxLength={30}
                      disabled={pending}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    required
                    disabled={pending}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="auth-field">
                <div className="auth-field-header">
                  <label htmlFor="auth-password">Password</label>
                  {!signingUp && (
                    <a
                      href={authRoute('/forgot-password', destination)}
                      className="auth-link auth-forgot-link"
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={signingUp ? 'new-password' : 'current-password'}
                    placeholder={signingUp ? 'At least 8 characters' : 'Enter your password'}
                    required
                    minLength={signingUp ? 8 : undefined}
                    disabled={pending}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>

                {signingUp && (
                  <div className="auth-password-requirements">
                    <span
                      className={`requirement-pill ${isPasswordValid ? 'requirement-pill--valid' : ''}`}
                    >
                      <Check size={12} aria-hidden="true" />
                      At least 8 characters
                    </span>
                  </div>
                )}
              </div>

              <button
                className="button button--primary auth-submit"
                type="submit"
                disabled={pending || (signingUp && (!isPasswordValid || !isUsernameValid))}
              >
                {pending ? (
                  <span className="auth-loading-state">
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>{signingUp ? 'Creating account…' : 'Signing in…'}</span>
                  </span>
                ) : (
                  <span>{signingUp ? 'Create account' : 'Sign in'}</span>
                )}
              </button>
            </form>
          )}
        </div>

        {!complete && !twoFactorStep && (
          <p className="auth-switch">
            {signingUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              className="auth-switch-button"
              onClick={() => switchMode(signingUp ? 'login' : 'register')}
            >
              {signingUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}
      </section>
    </main>
  );
}
