import { useState, type FormEvent, useEffect } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, User, X, AlertCircle } from 'lucide-react';
import { sessionKey } from '../WorkspacePicker';
import { authRoute, requestedWorkspace } from '../auth-routing';

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

  const destination = requestedWorkspace();

  // URL alerts
  const [notice, setNotice] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setCurrentMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('passwordChanged') === '1') {
      setNotice({ type: 'success', text: 'Your password has been changed. Please sign in with your new password.' });
    } else if (params.get('resetSuccess') === '1') {
      setNotice({ type: 'success', text: 'Password reset successful! Sign in with your new password.' });
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

      if (!response.ok || (signingUp ? !result?.id : !result?.accessToken)) {
        const detail = result?.message;
        setErrorMessage(
          response.status >= 500
            ? 'Authentication is temporarily unavailable. Please try again later.'
            : Array.isArray(detail)
            ? detail.join(' ')
            : detail || (signingUp ? 'Unable to create your account.' : 'Invalid email or password.'),
        );
        return;
      }

      if (!signingUp) {
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
        <a className="auth-close" href="/" aria-label="Back to DevUP home">
          <X size={20} aria-hidden="true" />
        </a>
      </header>

      <section className="auth-shell" aria-labelledby="auth-title">
        {/* Switcher Tabs */}
        {!complete && (
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={!signingUp}
              className={`auth-tab ${!signingUp ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={signingUp}
              className={`auth-tab ${signingUp ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Create Account
            </button>
          </div>
        )}

        <div className="auth-header-copy">
          <h1 id="auth-title">
            {complete
              ? 'Account created!'
              : signingUp
              ? 'Join DevUP'
              : 'Welcome back'}
          </h1>
          {!complete && (
            <p className="auth-description">
              {signingUp
                ? 'Bring tasks, conversations, and code into one unified space.'
                : 'Enter your credentials to access your workspaces.'}
            </p>
          )}
        </div>

        <div className="auth-panel">
          {/* Status / Alert Notices */}
          {notice && !errorMessage && !complete && (
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

          {complete ? (
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
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>

                {signingUp && (
                  <div className="auth-password-requirements">
                    <span className={`requirement-pill ${isPasswordValid ? 'requirement-pill--valid' : ''}`}>
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
                  <span>
                    {signingUp ? 'Create account' : 'Sign in'}
                  </span>
                )}
              </button>
            </form>
          )}
        </div>

        {!complete && (
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
