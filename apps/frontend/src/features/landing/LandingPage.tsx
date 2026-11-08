import { useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { BoardPreview } from './BoardPreview';
import { ProductScenes } from './ProductScenes';
import { LandingDetails } from './LandingDetails';
import { LogoCarousel } from './LogoCarousel';
import './hero.css';

function Brand() {
  return <a className="brand" href="/" aria-label="DevUP home"><img src="/devup.svg" alt="" width="34" height="34" /><span>DevUP</span></a>;
}

export function LandingPage() {
  useEffect(() => {
    // The initial fragment may resolve before React renders the landing page.
    const fragment = window.location.hash.slice(1);
    if (fragment) document.getElementById(fragment)?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return <div className="landing">
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
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-copy section-wrap">
          <h1 id="hero-heading">From idea to impact,<br />all in one flow.</h1>
          <p>A clear next step. A connected team. A place for the whole project.<br className="desktop-break" /> Bring your tasks, conversations, and code together with DevUP.</p>
          <div className="hero-actions"><a className="button button--primary" href="/register">Create an account <ArrowRight size={17} /></a><a className="button button--secondary" href="#preview">Explore the board</a></div>
        </div>
        <picture className="hero-workflow">
          <source media="(max-width: 600px)" srcSet="/illustrations/workflow-phone.png" width="1254" height="1254" />
          <source media="(max-width: 1024px)" srcSet="/illustrations/workflow-tablet.png" width="1536" height="1024" />
          <img src="/illustrations/workflow-wide.png" width="2400" height="834" alt="" fetchPriority="high" />
        </picture>
        <div className="hero-footnote">One workspace. Every part of the work.</div>
      </section>
      <LogoCarousel />
      <section id="preview" className="board-showcase" aria-labelledby="board-heading">
        <div className="showcase-heading section-wrap">
          <h2 id="board-heading">A unified platform for building, shipping, and collaborating.</h2>
        </div>
        <BoardPreview />
      </section>
      <ProductScenes />
      <LandingDetails />
    </main>
    <footer className="site-footer section-wrap"><Brand /><span>A shared space for work in motion.</span><a href="#hero-heading">Back to top ?</a></footer>
  </div>;
}
export function AuthPreview({ mode }: { mode: 'login' | 'register' }) {
  return <main className="auth-preview section-wrap"><Brand /><div><h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1><p>This screen is coming in the next frontend milestone.</p><a className="button button--secondary" href="/"><ArrowLeft size={17} /> Back to DevUP</a></div></main>;
}
