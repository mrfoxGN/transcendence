import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { accountRequest, authRoute, requestedWorkspace } from './auth-routing';
import { sessionKey } from './auth/session';
import { AvatarPicker, type AvatarSelection } from './AvatarPicker';
import { OtpCodeInput } from './auth/OtpCodeInput';
import { ResendCodeButton } from './auth/ResendCodeButton';
import { VerifiedUserBadge } from './auth/VerifiedUserBadge';
import { Check, Eye, EyeOff, Lock, Mail, ArrowRight, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import './landing/auth.css';
import './account-onboarding.css';
import { EntryThemeControl } from './auth/EntryAppearance';

export interface AccountShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onboarding?: boolean;
  backHref?: string;
}

export function AccountShell({
  title,
  subtitle,
  children,
  onboarding = false,
  backHref,
}: AccountShellProps) {
  return (
    <main className={onboarding ? 'auth-page account-onboarding' : 'auth-page'}>
      <header className="auth-header">
        <a href="/" className="brand" aria-label="DevUP home">
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
        <div className="entry-header-actions"><EntryThemeControl />{backHref ? (
          <a href={backHref} className="auth-header-action" aria-label="Go back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back</span>
          </a>
        ) : (
          <a href="/" className="auth-close" aria-label="Back to home">
            <ArrowLeft size={18} aria-hidden="true" />
          </a>
        )}</div>
      </header>

      <section className="auth-shell" aria-labelledby="account-title">
        <div className="auth-header-copy">
          <h1 id="account-title">{title}</h1>
          {subtitle && <p className="auth-description">{subtitle}</p>}
        </div>
        <div className="auth-panel">{children}</div>
      </section>
    </main>
  );
}

function EmailArtwork() {
  return (
    <div className="account-email-artwork" aria-hidden="true">
      <span />
    </div>
  );
}

export interface EmailVerificationFormProps {
  token: string;
  onVerified: () => void;
  email?: string;
}

export function EmailVerificationForm({
  token,
  onVerified,
  email,
}: EmailVerificationFormProps) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  async function sendVerificationCode() {
    if (pending) return;
    setPending(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      await accountRequest('email-verification/request', undefined, token);
      setCodeSent(true);
      setStatusMessage('A 6-digit verification code has been sent. It expires in 10 minutes.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send verification email. Try again.');
      throw err;
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setPending(true);
    setErrorMessage('');

    try {
      await accountRequest('email-verification/confirm', { code: trimmedCode }, token);
      onVerified();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid or expired verification code. Try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleConfirm}>
      {email && (
        <div className="auth-target-info">
          <Mail size={16} className="auth-target-icon" aria-hidden="true" />
          <span>Code sent to <strong>{email}</strong></span>
        </div>
      )}

      {statusMessage && (
        <div className="auth-alert auth-alert--info" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="auth-alert auth-alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="verify-code">Enter 6-digit verification code</label>
        <OtpCodeInput
          id="verify-code"
          value={code}
          onChange={(val) => {
            setCode(val);
            if (errorMessage) setErrorMessage('');
          }}
          onComplete={() => {
            // Can auto-submit when all 6 digits entered
          }}
          disabled={pending}
          hasError={Boolean(errorMessage)}
          autoFocus
        />
      </div>

      <div className="auth-actions-row">
        <ResendCodeButton
          onResend={sendVerificationCode}
          storageKey="devup_email_verify_cooldown"
          disabled={pending}
          label={codeSent ? 'Resend code' : 'Send verification code'}
          resendLabel="Resend code"
        />
      </div>

      <button
        className="button button--primary auth-submit"
        type="submit"
        disabled={pending || code.length !== 6}
      >
        {pending ? (
          <span className="auth-loading-state">
            <span className="auth-spinner" aria-hidden="true" />
            <span>Verifying…</span>
          </span>
        ) : (
          <span>Verify email</span>
        )}
      </button>
    </form>
  );
}

export function AccountRecovery({ mode }: { mode: 'request' | 'reset' | 'verify' }) {
  const destination = requestedWorkspace();
  const token = sessionStorage.getItem(sessionKey);

  // Reset password states
  const [resetStep, setResetStep] = useState(mode === 'reset');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & error states
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [complete, setComplete] = useState(false);

  // Verify email profile state (for mode === 'verify')
  const [userProfile, setUserProfile] = useState<{
    id: string;
    username: string;
    email: string;
    emailVerified?: boolean;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(mode === 'verify' && Boolean(token));

  useEffect(() => {
    if (mode !== 'verify' || !token) return;

    const controller = new AbortController();
    fetch('/api/auth/profile', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.ok) {
          const profile = await res.json();
          setUserProfile(profile);
          if (profile.emailVerified) {
            setComplete(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));

    return () => controller.abort();
  }, [mode, token]);

  const isPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSendResetCode() {
    if (!email.trim() || pending) return;
    setPending(true);
    setErrorMessage('');

    try {
      await accountRequest('password-reset/request', { email: email.trim() });
      setResetStep(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not send reset code. Please try again.',
      );
      throw err;
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!code.trim() || code.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit code received by email.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setPending(true);
    setErrorMessage('');

    try {
      await accountRequest('password-reset/confirm', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });

      sessionStorage.removeItem(sessionKey);
      setComplete(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid or expired code. Please request a new one.',
      );
    } finally {
      setPending(false);
    }
  }

  // Determine Title & Subtitle based on mode and step
  let title = 'Reset your password';
  let subtitle = 'Enter your email to receive a recovery code.';

  if (mode === 'verify') {
    title = complete ? 'Email verified' : 'Verify your email';
    subtitle = complete
      ? 'Your email address is verified and active.'
      : 'Enter the verification code sent to your email.';
  } else if (resetStep && !complete) {
    title = 'Create new password';
    subtitle = `Enter the 6-digit recovery code and choose a new password.`;
  } else if (complete) {
    title = 'Password reset complete';
    subtitle = 'Your password has been successfully updated.';
  }

  return (
    <AccountShell
      title={title}
      subtitle={subtitle}
      onboarding={mode === 'verify'}
      backHref={authRoute('/login', destination)}
    >
      {mode === 'verify' && <EmailArtwork />}

      {/* Mode: Verify Email */}
      {mode === 'verify' && (
        <>
          {profileLoading ? (
            <div className="auth-loading-state">
              <span className="auth-spinner" aria-hidden="true" />
              <span>Loading account profile…</span>
            </div>
          ) : complete || userProfile?.emailVerified ? (
            <div className="auth-success-card" role="status">
              <div className="auth-success-icon" aria-hidden="true">
                <ShieldCheck size={32} />
              </div>
              <VerifiedUserBadge isVerified size="large" />
              <h2>Email verified!</h2>
              <p>Your email address is confirmed. You can now access all workspaces.</p>
              <a className="button button--primary auth-submit" href={destination}>
                Open workspaces
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          ) : token ? (
            <div className="auth-verify-wrap">
              <EmailVerificationForm
                token={token}
                email={userProfile?.email}
                onVerified={() => setComplete(true)}
              />
              <div className="auth-skip-row">
                <a className="auth-text-link" href={destination}>
                  Skip for now, verify later
                </a>
              </div>
            </div>
          ) : (
            <div className="auth-notice-card">
              <p>Sign in to your account to verify your email address.</p>
              <a
                className="button button--primary auth-submit"
                href={authRoute('/login', destination) + '&onboarding=1'}
              >
                Sign in to verify
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          )}
        </>
      )}

      {/* Mode: Password Recovery (Request / Reset) */}
      {mode !== 'verify' && (
        <>
          {complete ? (
            <div className="auth-success-card" role="status">
              <div className="auth-success-icon" aria-hidden="true">
                <Check size={32} />
              </div>
              <h2>Password updated!</h2>
              <p>Your password has been reset successfully. You can now sign in with your new password.</p>
              <a
                className="button button--primary auth-submit"
                href={authRoute('/login', destination) + '&resetSuccess=1'}
              >
                Sign in with new password
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          ) : !resetStep ? (
            /* Step 1: Request Code */
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendResetCode();
              }}
            >
              {errorMessage && (
                <div className="auth-alert auth-alert--error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="reset-email">Account email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="reset-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    maxLength={320}
                    required
                    disabled={pending}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <button
                className="button button--primary auth-submit"
                type="submit"
                disabled={pending || !email.trim()}
              >
                {pending ? (
                  <span className="auth-loading-state">
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Sending code…</span>
                  </span>
                ) : (
                  <span>Send reset code</span>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: Confirm Reset with 6-digit Code & New Password */
            <form className="auth-form" onSubmit={handleConfirmReset} noValidate>
              <div className="auth-target-info">
                <Mail size={16} className="auth-target-icon" aria-hidden="true" />
                <span>
                  Code sent to <strong>{email}</strong>
                </span>
                <button
                  type="button"
                  className="auth-edit-link"
                  onClick={() => {
                    setResetStep(false);
                    setErrorMessage('');
                  }}
                >
                  Change
                </button>
              </div>

              {errorMessage && (
                <div className="auth-alert auth-alert--error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="reset-code">6-digit recovery code</label>
                <OtpCodeInput
                  id="reset-code"
                  value={code}
                  onChange={(val) => {
                    setCode(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  disabled={pending}
                  hasError={Boolean(errorMessage)}
                  autoFocus
                />
              </div>

              <div className="auth-actions-row">
                <ResendCodeButton
                  onResend={handleSendResetCode}
                  storageKey="devup_reset_password_cooldown"
                  disabled={pending}
                  resendLabel="Resend code"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="new-password">New password</label>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    disabled={pending}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                <div className="auth-password-requirements">
                  <span className={`requirement-pill ${isPasswordValid ? 'requirement-pill--valid' : ''}`}>
                    <Check size={12} aria-hidden="true" />
                    At least 8 characters
                  </span>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Re-type your new password"
                    minLength={8}
                    required
                    disabled={pending}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {confirmPassword && (
                  <div className="auth-password-requirements">
                    <span className={`requirement-pill ${passwordsMatch ? 'requirement-pill--valid' : 'requirement-pill--invalid'}`}>
                      <Check size={12} aria-hidden="true" />
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              <button
                className="button button--primary auth-submit"
                type="submit"
                disabled={pending || code.length !== 6 || !isPasswordValid || !passwordsMatch}
              >
                {pending ? (
                  <span className="auth-loading-state">
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Updating password…</span>
                  </span>
                ) : (
                  <span>Update password</span>
                )}
              </button>
            </form>
          )}

          {!complete && (
            <p className="auth-switch">
              <a href={authRoute('/login', destination)} className="auth-link">
                Back to sign in
              </a>
            </p>
          )}
        </>
      )}
    </AccountShell>
  );
}

export function FirstRun({ step }: { step: 'avatar' | 'email' }) {
  const token = sessionStorage.getItem(sessionKey);
  const destination = requestedWorkspace();
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    email: string;
    emailVerified?: boolean;
  }>();
  const [loadError, setLoadError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [saving, setSaving] = useState(false);
  const emailStep = step === 'email';
  const emailPath = authRoute('/onboarding/email', destination);

  useEffect(() => {
    if (!token) {
      location.replace(authRoute('/login', destination) + '&onboarding=1');
      return;
    }
    const controller = new AbortController();
    void fetch('/api/auth/profile', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          sessionStorage.removeItem(sessionKey);
          location.replace(authRoute('/login', destination) + '&onboarding=1');
          return;
        }
        if (!response.ok) throw new Error('Could not load your profile.');
        const result = await response.json();
        if (!controller.signal.aborted) setProfile(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('Could not load your profile. Try refreshing.');
      });
    return () => controller.abort();
  }, [token, destination]);

  function nextAfterAvatar() {
    location.replace(profile?.emailVerified ? destination : emailPath);
  }

  async function saveAvatar(avatar: AvatarSelection) {
    if (!profile || !token || saving) return;
    setSaving(true);
    setAvatarError('');
    try {
      const response = await fetch('/api/users/' + encodeURIComponent(profile.id), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(avatar),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(' ')
            : result?.message ?? 'Could not save your avatar. Try again.',
        );
      }
      nextAfterAvatar();
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not save your avatar.');
    } finally {
      setSaving(false);
    }
  }

  const title = emailStep
    ? profile?.emailVerified
      ? 'Email verified'
      : 'Verify your email'
    : 'Choose your avatar';

  const subtitle = emailStep
    ? profile?.emailVerified
      ? 'Your account email is verified and ready.'
      : 'Verify your account to receive project updates and invitations.'
    : 'Select an avatar or upload your own photo.';

  return (
    <AccountShell title={title} subtitle={subtitle} onboarding>
      {loadError && (
        <div className="auth-alert auth-alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {!profile && !loadError && (
        <div className="auth-loading-state">
          <span className="auth-spinner" aria-hidden="true" />
          <span>Loading your profile…</span>
        </div>
      )}

      {profile &&
        (emailStep ? (
          <div className="account-email-step">
            <EmailArtwork />
            <div className="account-user-verified-header">
              <VerifiedUserBadge isVerified={Boolean(profile.emailVerified)} size="medium" />
              <p>
                {profile.emailVerified ? (
                  'Your email address is confirmed.'
                ) : (
                  <>
                    Confirm <strong>{profile.email}</strong> to verify your account.
                  </>
                )}
              </p>
            </div>

            {!profile.emailVerified && token && (
              <EmailVerificationForm
                token={token}
                email={profile.email}
                onVerified={() => setProfile({ ...profile, emailVerified: true })}
              />
            )}

            <a
              className={profile.emailVerified ? 'button button--primary' : 'button button--secondary'}
              href={destination}
            >
              {profile.emailVerified ? 'Continue to DevUP' : 'Verify later'}
            </a>
          </div>
        ) : (
          <AvatarPicker
            showPreview
            saving={saving}
            error={avatarError}
            onSave={(avatar) => void saveAvatar(avatar)}
            onSkip={nextAfterAvatar}
          />
        ))}
    </AccountShell>
  );
}
