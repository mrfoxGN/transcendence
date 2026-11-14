import { AnimatedHeading } from './AnimatedHeading';
import { LandingReviews } from './LandingReviews';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { sampleProject, sampleRepository } from './sampleData';
import './github-showcase.css';
import { FileCode, GitBranch, GitCommitHorizontal, Github, Minus, Plus } from 'lucide-react';

const questions = [
  { question: 'Can I connect a private repository?', answer: 'DevUP currently supports eligible public GitHub repositories. A workspace owner can connect one repository per workspace. The browser handoff for first-time setup is still in development.' },
  { question: 'How do commits refresh?', answer: 'Workspace members can refresh recent commits manually. DevUP stores those commits so members can browse them from the workspace.' },
  { question: 'Can I see file diffs in DevUP?', answer: 'DevUP shows commit details. Open the commit on GitHub to view its changed files and line-by-line diff.' },
  { question: 'How does the work-in-progress limit work?', answer: 'The board counts tasks in In Progress and Review. When the workspace reaches its limit, the team needs to finish active work before starting another ready task.' },
  { question: 'Are direct messages separate from team chat?', answer: 'Yes. Direct messages are separate from workspace chat, so you can continue a private conversation while switching between workspaces.' },
];

const steps = [
  { label: 'Repository', title: 'Bring your code into DevUP.', description: 'Connect a public GitHub repository to see its default branch and when it last synced.' },
  { label: 'Branches', title: 'See where work is happening.', description: 'Browse branch names and head commits, with a badge for protected branches.' },
  { label: 'Commits', title: 'Follow the work into code.', description: 'Open a commit to see who authored it, who committed it, and when.' },
  { label: 'Code changes', title: 'See what changed in each file.', description: 'This concept preview shows how a file diff could display added and removed lines.' },
];

export function LandingDetails() {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const controls = useRef<HTMLDivElement>(null);
  const inView = useInView(controls, { amount: .22 });
  const reduced = useReducedMotion();
  const playing = inView && pageVisible && !reduced;


  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  function goTo(next: number) {
    setStep(next);
    setRun(value => value + 1);
  }

  const panels = [
            <div className="github-panel">
              <h4><Github size={19} aria-hidden="true" /> {sampleRepository.name}</h4>
              <dl><div data-demo-motion="repository"><dt>Visibility</dt><dd>Public</dd></div><div data-demo-motion="repository"><dt>Default branch</dt><dd><code>{sampleRepository.branches[0]}</code></dd></div><div data-demo-target><dt>Last sync</dt><dd><small className="github-sync" data-demo-motion="sync"><span aria-hidden="true" /> Synced</small> 2 minutes ago</dd></div></dl>
            </div>,
            <div className="github-panel">
              <h4><GitBranch size={19} aria-hidden="true" /> Branches <small>{sampleRepository.branches.length} branches</small></h4><div className="github-panel-labels"><span>Branch</span><span>Head commit</span></div>
              <dl>{sampleRepository.branches.map((branch, index) => (
                <div key={branch} data-demo-motion="branch" data-demo-target={index === 0 ? true : undefined}><dt><code>{branch}</code>{index === 0 && <small data-demo-motion="protected">Protected</small>}</dt><dd><code>{sampleRepository.commits[index].sha}</code></dd></div>
              ))}</dl>
            </div>,
            <div className="github-panel">
              <h4><GitCommitHorizontal size={19} aria-hidden="true" /> {sampleRepository.commits[2].title} <small>{sampleProject.taskId}</small></h4>
              <div className="github-commit-layout">
                <ul className="github-commit-list" aria-label="Sample recent commits">
                  {[...sampleRepository.commits].reverse().map((commit, index) => (
                    <li key={commit.sha} data-demo-motion="commit" data-demo-target={index === 0 ? true : undefined} className={index === 0 ? 'github-selected' : undefined}>
                      <strong>{commit.title}</strong><code>{commit.sha}</code>
                    </li>
                  ))}
                </ul>
                <dl className="github-demo-result"><div data-demo-motion="metadata"><dt>Author</dt><dd>Alex Morgan</dd></div><div data-demo-motion="metadata"><dt>Committer</dt><dd>Jamie Chen</dd></div><div data-demo-motion="metadata"><dt>Committed</dt><dd>Apr 12, 10:24</dd></div><div data-demo-motion="metadata"><dt>SHA</dt><dd><code>{sampleRepository.commits[2].sha}</code></dd></div></dl></div>
            </div>,
            <div className="github-panel">
              <h4><FileCode size={19} aria-hidden="true" /> Changed files <small>Concept preview</small></h4>
              <div className="github-code-layout"><ul className="github-files"><li className="github-selected" data-demo-motion="file" data-demo-target><code>src/pages/Login.tsx</code></li><li><code>src/styles/auth.css</code></li></ul>
              <div className="github-code-preview github-demo-result"><div className="github-code-header"><code>Login.tsx</code><span><b>+2</b> <b>−1</b></span></div><pre className="github-diff" tabIndex={0} aria-label="Example diff for Login.tsx"><code>
                <span className="github-diff-removed" data-demo-motion="line">19 - {'<input type="email" />'}</span>
                <span className="github-diff-added" data-demo-motion="line">19 + {'<input type="email" aria-invalid={!!emailError} />'}</span>
                <span className="github-diff-added" data-demo-motion="line">20 + {'{emailError && <p role="alert">{emailError}</p>}'}</span>
              </code></pre></div></div>
            </div>,
  ];
  return (
    <>
      <section className="github-showcase section-wrap" id="github" aria-labelledby="github-title">
        <header className="github-showcase-heading">
          <h2 id="github-title">Keep your code in view.</h2>
          <p>Browse branches and commits alongside the work that led to them.</p>
        </header>
        <div className="github-demo-controls">
          <div className="github-stepper" data-playing={playing} role="group" aria-label="GitHub walkthrough steps">
            {steps.map(({ label }, index) => (
              <button key={label} type="button" data-step={index} data-complete={index < step} aria-current={index === step ? 'step' : undefined}
                aria-controls="github-feature-preview" onClick={() => goTo(index)}>
                <svg className="github-step-outline" aria-hidden="true" width="100%" height="100%">
                  <rect className="github-step-track" x="1" y="1" rx="9" pathLength="100" />
                  <rect key={index === step ? run : label} className="github-step-progress" x="1" y="1" rx="9" pathLength="100"
                    onAnimationEnd={index === step && !reduced ? () => goTo((step + 1) % steps.length) : undefined} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div id="github-feature-preview" ref={controls} className="github-feature" data-step={step} data-playing={playing}>
          <div className="github-feature-copy-stack">
            {steps.map(({ label, title, description }, index) => (
              <div className="github-feature-copy" key={label} data-active={index === step} inert={index !== step}>
                <span className="github-feature-label"><Github size={18} aria-hidden="true" /> {label}</span>
                <AnimatedHeading key={index === step ? run : label} as="h3" lines={[title]} />
                <p>{description}</p>
              </div>
            ))}
          </div>
          <div className="github-feature-demo-stack">
            {steps.map(({ label }, index) => {
              const active = index === step;
              return (
                <div className="github-feature-demo" key={active ? `${label}-${run}` : label} data-active={active} inert={!active}>
                  <div className="github-demo-bar"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span>DevUP / GitHub</span><small>Sample data</small></div>
                  {panels[index]}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <LandingReviews />
      <section className="faq section-wrap" aria-labelledby="faq-title">
        <div className="section-intro"><h2 id="faq-title">Questions about DevUP</h2><p>A few details about your workspace and GitHub setup.</p></div>
        <div className="faq-list">{questions.map(({ question, answer }, index) => (
          <details key={question} name="devup-faq" open={index === 0}>
            <summary>{question}<Plus className="faq-plus" size={20} aria-hidden="true" /><Minus className="faq-minus" size={20} aria-hidden="true" /></summary>
            <p>{answer}</p>
          </details>
        ))}</div>
      </section>
    </>
  );
}
