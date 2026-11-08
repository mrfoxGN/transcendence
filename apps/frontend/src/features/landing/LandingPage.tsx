import { AnimatedHeading } from './AnimatedHeading';
import { useEffect, useState, type FormEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { BoardPreview } from './BoardPreview';
import { ProductScenes } from './ProductScenes';
import { LandingDetails } from './LandingDetails';
import { LogoCarousel } from './LogoCarousel';
import { ContainerScroll, ScrollTextReveal } from './LandingMotion';
import { MagicButton } from './MagicButton';
import './hero.css';

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
          <a className="button button--secondary" href="/login">Log in</a>
          <a className="button button--primary" href="/register">Sign up</a>
        </div>
      </div>
    </header>
    <main id="main">
      <section className="landing-hero" aria-labelledby="hero-heading" onPointerMove={moveHeroGlow} onPointerLeave={event => { event.currentTarget.style.removeProperty("--hero-glow-x"); event.currentTarget.style.removeProperty("--hero-glow-y"); }}>
        <div className="landing-hero-copy section-wrap">
          <AnimatedHeading as="h1" id="hero-heading" lines={["From idea to impact,", "all in one flow."]} />
          <p>A clear next step. A connected team. A place for the whole project.<br className="desktop-break" /> Bring your tasks, conversations, and code together with DevUP.</p>
          <div className="hero-actions"><MagicButton href="/register" variant="secondary">Create an account</MagicButton></div>
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
        <MagicButton href="/register" variant="secondary">Get started</MagicButton>
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
                <ul><li><a href="/login">Log in</a></li><li><a href="/register">Sign up</a></li></ul>
              </div>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>&copy; DevUP</span>
            <a href="#top">Back to top <ArrowUp size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
    </div>
  </div>;
}
export function AuthPreview({ mode }: { mode: 'login' | 'register' }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [registered, setRegistered] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const detail = error?.message;
        setMessage(response.status >= 500
          ? 'Account setup is temporarily unavailable. Try again later.'
          : Array.isArray(detail) ? detail.join(' ') : detail || 'Unable to create your account.');
        return;
      }
      setRegistered(true);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void import('canvas-confetti').then(({ default: confetti }) => confetti({
          particleCount: 52,
          spread: 58,
          origin: { y: .62 },
          colors: ['#a8c9ff', '#b7a3ff', '#f9b9de', '#245bc9'],
          disableForReducedMotion: true,
        })).catch(() => {});
      }
    } catch {
      setMessage('Could not reach account setup. Try again later.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-preview section-wrap">
      <Brand />
      <div>
        <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
        {mode === 'login' ? <p>This screen is coming in the next frontend milestone.</p> : registered ? (
          <p role="status">Your DevUP account has been created.</p>
        ) : (
          <form className="auth-form" onSubmit={register}>
            <label>Username<input name="username" autoComplete="username" minLength={3} maxLength={30} required /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
            <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            {message && <p role="alert">{message}</p>}
            <button className="button button--primary" type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create an account'}</button>
          </form>
        )}
        <a className="button button--secondary" href="/"><ArrowLeft size={17} /> Back to DevUP</a>
      </div>
    </main>
  );
}
