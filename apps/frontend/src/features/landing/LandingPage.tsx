import { sessionKey } from '../WorkspacePicker';
import { AnimatedHeading } from './AnimatedHeading';
import { useEffect, useState, type PointerEvent } from 'react';
import { ArrowUp } from 'lucide-react';
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

export { AuthPreview } from '../auth/AuthPreview';

