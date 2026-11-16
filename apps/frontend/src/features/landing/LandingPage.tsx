import { sessionKey } from '../WorkspacePicker';
import { authRoute, requestedWorkspace } from '../auth-routing';
import { AnimatedHeading } from './AnimatedHeading';
import { useEffect, useState, type FormEvent, type PointerEvent } from 'react';
import { ArrowUp, Check, Eye, EyeOff, X } from 'lucide-react';
import { BoardPreview } from './BoardPreview';
import { ProductScenes } from './ProductScenes';
import { LandingDetails } from './LandingDetails';
import { LogoCarousel } from './LogoCarousel';
import { ContainerScroll, ScrollTextReveal } from './LandingMotion';
import { MagicButton } from './MagicButton';
import { LegalLinks } from './LegalLinks';
import './hero.css';
import './auth.css';

function Brand() {
  return <a className="brand" href="/" aria-label="DevUP home"><svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#245bc9" /><path d="m11 21 13-10 13 10M11 33l13-10 13 10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg><span>DevUP</span></a>;
}

function moveHeroGlow(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = event.currentTarget;
  const bounds = hero.getBoundingClientRect();
  hero.style.setProperty('--hero-glow-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 44}px`);
  hero.style.setProperty('--hero-glow-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 36}px`);
}

export function LandingPage() {
  const [signedIn, setSignedIn] = useState(() => Boolean(sessionStorage.getItem(sessionKey)));

  useEffect(() => {
    const controller = new AbortController();
    function syncSession() {
      const token = sessionStorage.getItem(sessionKey);
      setSignedIn(Boolean(token));
      if (!token) return;
      void fetch('/api/auth/profile', {
        headers: { Authorization: 'Bearer ' + token },
        signal: controller.signal,
      }).then(response => {
        if (controller.signal.aborted || sessionStorage.getItem(sessionKey) !== token) return;
        if (response.status === 401) {
          sessionStorage.removeItem(sessionKey);
          setSignedIn(false);
        }
      }).catch(() => {});
    }

    syncSession();
    window.addEventListener('pageshow', syncSession);
    return () => {
      controller.abort();
      window.removeEventListener('pageshow', syncSession);
    };
  }, []);
  useEffect(() => {
    // The initial fragment may resolve before React renders the landing page.
    const fragment = window.location.hash.slice(1);
    if (fragment) document.getElementById(fragment)?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return <div className="landing" id="top">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="landing-navbar">
      <div className="landing-header section-wrap">
        <Brand />
        <nav aria-label="Main navigation"><a href="#preview">The board</a><a href="#features">Workspace</a><a href="#github">GitHub</a></nav>
        <div className="navbar-actions">
          {signedIn ? <a className="button button--primary" href="/workspaces">Open workspace</a> : (
            <>
              <a className="button button--secondary" href="/login">Log in</a>
              <a className="button button--primary" href="/register">Sign up</a>
            </>
          )}
        </div>
      </div>
    </header>
    <main id="main">
      <section className="landing-hero" aria-labelledby="hero-heading" onPointerMove={moveHeroGlow} onPointerLeave={event => { event.currentTarget.style.removeProperty("--hero-glow-x"); event.currentTarget.style.removeProperty("--hero-glow-y"); }}>
        <div className="landing-hero-copy section-wrap">
          <AnimatedHeading as="h1" id="hero-heading" lines={["From idea to impact,", "all in one flow."]} />
          <p>A clear next step. A connected team. A place for the whole project.<br className="desktop-break" /> Bring your tasks, conversations, and code together with DevUP.</p>
          <div className="hero-actions"><MagicButton href={signedIn ? "/workspaces" : "/register"} variant="secondary">{signedIn ? "Open workspace" : "Create an account"}</MagicButton></div>
        </div>
        <picture className="hero-workflow" aria-hidden="true">
          <source media="(max-width: 600px)" srcSet="/illustrations/workflow-phone.png" width="1254" height="1254" />
          <source media="(max-width: 1024px)" srcSet="/illustrations/workflow-tablet.png" width="1536" height="1024" />
          <img src="/illustrations/workflow-wide.png" width="2400" height="834" alt="" fetchPriority="high" onError={event => { event.currentTarget.closest("picture")?.setAttribute("hidden", ""); }} />
        </picture>
        <div className="hero-footnote">One workspace. Every part of the work.</div>
      </section>
      <LogoCarousel />
      <section id="preview" className="board-showcase" aria-labelledby="board-heading">
        <div className="showcase-heading section-wrap">
          <h2 id="board-heading">A unified platform for building, shipping, and collaborating.</h2>
        </div>
        <ContainerScroll>{ready => <BoardPreview ready={ready} />}</ContainerScroll>
      </section>
      <ScrollTextReveal text="A task is more than a card. Follow the conversations, decisions, and files that help your team take it from an idea to something they can ship." />
      <ProductScenes />
      <LandingDetails />
    </main>
    <div className="story-closing">
      <section className="closing-copy section-wrap" aria-labelledby="closing-heading">
        <img src="/devup.svg" alt="" width="48" height="48" />
        <h2 id="closing-heading">Your next idea starts here.</h2>
        <MagicButton href={signedIn ? "/workspaces" : "/register"} variant="secondary">{signedIn ? "Open workspace" : "Get started"}</MagicButton>
      </section>
      <footer className="site-footer">
        <div className="section-wrap">
          <div className="footer-main">
            <div className="footer-brand">
              <Brand />
              <p>A shared space for work in motion.</p>
            </div>
            <nav className="footer-links" aria-label="Footer navigation">
              <div>
                <h2>Explore</h2>
                <ul><li><a href="#preview">The board</a></li><li><a href="#features">Workspace</a></li><li><a href="#github">GitHub</a></li></ul>
              </div>
              <div>
                <h2>Account</h2>
                <ul>{signedIn ? <li><a href="/workspaces">Open workspace</a></li> : <><li><a href="/login">Log in</a></li><li><a href="/register">Sign up</a></li></>}</ul>
              </div>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>&copy; DevUP</span>
            <LegalLinks />
            <a href="#top">Back to top <ArrowUp size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
    </div>
  </div>;
}
export function AuthPreview({ mode }: { mode: 'login' | 'register' }) {
  const signingUp = mode === 'register';
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const destination = requestedWorkspace();
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || (signingUp ? !result?.id : !result?.accessToken)) {
        const detail = result?.message;
        setMessage(response.status >= 500
          ? 'Authentication is temporarily unavailable. Try again later.'
          : Array.isArray(detail) ? detail.join(' ') : detail ||
            (signingUp ? 'Unable to create your account.' : 'Unable to sign in.'));
        return;
      }

      if (!signingUp) {
        sessionStorage.setItem(sessionKey, result.accessToken);
        const onboarding = new URLSearchParams(location.search).get('onboarding') === '1';
        window.location.replace(onboarding ? authRoute('/onboarding', destination) : destination);
        return;
      }
      try {
        const login = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: fields.email, password: fields.password }),
        });
        const credentials = await login.json().catch(() => null);
        if (login.ok && typeof credentials?.accessToken === 'string' && credentials.accessToken) {
          sessionStorage.setItem(sessionKey, credentials.accessToken);
          window.location.replace(authRoute('/onboarding', destination));
          return;
        }
      } catch {
        // Account creation succeeded. The user can continue with manual sign-in.
      }

      setComplete(true);
      if (signingUp && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void import('canvas-confetti').then(({ default: confetti }) => confetti({
          particleCount: 52,
          spread: 58,
          origin: { y: .62 },
          colors: ['#a8c9ff', '#b7a3ff', '#f9b9de', '#245bc9'],
          disableForReducedMotion: true,
        })).catch(() => {});
      }
    } catch {
      setMessage('Could not reach DevUP. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Brand />
        <a className="auth-close" href="/" aria-label="Back to DevUP"><X size={20} aria-hidden="true" /></a>
      </header>
      <section className="auth-shell" aria-labelledby="auth-title">
        <h1 id="auth-title">{complete ? 'Account created' : (signingUp ? 'Create an account' : 'Sign in to DevUP')}</h1>
        {!complete && <p className="auth-description">{signingUp
          ? 'Bring your tasks, conversations, and code into one workspace.'
          : 'Enter your email and password.'}</p>}
        <div className="auth-panel">
          {complete ? (
            <div className="auth-success" role="status">
              <p><Check size={18} aria-hidden="true" /> Your DevUP account is ready.</p>
              <a className="button button--primary" href={authRoute('/login', destination) + '&onboarding=1'}>Sign in</a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {signingUp && <label htmlFor="auth-username">Username
                <input id="auth-username" name="username" placeholder="e.g. nourdev" autoComplete="username" minLength={3} maxLength={30} required />
              </label>}
              <label htmlFor="auth-email">Email
                <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
              <div className="auth-password">
                <label htmlFor="auth-password">Password</label>
                <div className="auth-password-field">
                  <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'}
                    autoComplete={signingUp ? 'new-password' : 'current-password'} minLength={signingUp ? 8 : undefined}
                    aria-describedby={signingUp ? 'auth-password-hint' : undefined} required />
                  <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(value => !value)}>
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {signingUp && <small id="auth-password-hint">Use at least 8 characters.</small>}
              </div>
              {message && <p className="auth-error" role="alert">{message}</p>}
              {!signingUp && <a href={authRoute('/forgot-password', destination)}>Forgot your password?</a>}
              <button className="button button--primary auth-submit" type="submit" disabled={pending}>
                {signingUp ? (pending ? 'Creating account…' : 'Create an account') : (pending ? 'Signing in…' : 'Sign in')}
              </button>
            </form>
          )}
        </div>
        {!complete && (
          <p className="auth-switch">{signingUp ? 'Already have an account?' : 'New to DevUP?'}{' '}
            <a href={authRoute(signingUp ? '/login' : '/register', destination)}>{signingUp ? 'Sign in' : 'Create an account'}</a>
          </p>
        )}
      </section>
    </main>
  );
}
