import { Children, useState, useSyncExternalStore } from 'react';
import { BentoGrid } from './BentoGrid';
import { sampleRepository } from './sampleData';
import { ScrollStack } from './ScrollStack';
import './github-showcase.css';
import { FileCode, GitBranch, GitCommitHorizontal, Github, Minus, Plus } from 'lucide-react';

const questions = [
  { question: 'Can I connect a private repository?', answer: 'DevUP currently supports eligible public GitHub repositories. A workspace owner can connect one repository per workspace. The browser handoff for first-time setup is still in development.' },
  { question: 'How do commits refresh?', answer: 'Workspace members can refresh recent commits manually. DevUP stores those commits so members can browse them from the workspace.' },
  { question: 'Can I see file diffs in DevUP?', answer: 'DevUP shows commit details. Open the commit on GitHub to view its changed files and line-by-line diff.' },
  { question: 'How does the work-in-progress limit work?', answer: 'The board counts tasks in In Progress and Review. When the workspace reaches its limit, the team needs to finish active work before starting another ready task.' },
  { question: 'Are direct messages separate from team chat?', answer: 'Yes. Direct messages are separate from workspace chat, so you can continue a private conversation while switching between workspaces.' },
];

const mobileLayout = '(max-width: 760px)';

function subscribeToLayout(callback: () => void) {
  const query = window.matchMedia(mobileLayout);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function isMobileLayout() {
  return window.matchMedia(mobileLayout).matches;
}

export function LandingDetails() {
  const mobile = useSyncExternalStore(subscribeToLayout, isMobileLayout);
  const [step, setStep] = useState(0);
  const cards = [
    <article key="blue" className="github-card github-card--blue">
            <div><Github className="github-feature-icon" size={24} aria-hidden="true" /><h3>Connect a repository</h3><p>Bring a public GitHub repository into your DevUP workspace.</p></div>
            <div className="github-panel">
              <h4><Github size={19} aria-hidden="true" /> {sampleRepository.name}</h4>
              <dl><div><dt>Visibility</dt><dd>Public</dd></div><div><dt>Default branch</dt><dd><code>{sampleRepository.branches[0]}</code></dd></div><div><dt>Last sync</dt><dd><small className="github-sync">Synced</small> 2 minutes ago</dd></div></dl>
            </div>
          </article>,
          <article key="violet" className="github-card github-card--violet">
            <div><GitBranch className="github-feature-icon" size={24} aria-hidden="true" /><h3>Browse branches</h3><p>See active branches, their latest commits, and which branches are protected.</p></div>
            <div className="github-panel">
              <h4><GitBranch size={19} aria-hidden="true" /> Branches <small>{sampleRepository.branches.length} branches</small></h4><div className="github-panel-labels"><span>Branch</span><span>Head commit</span></div>
              <dl>{sampleRepository.branches.map((branch, index) => (
                <div key={branch}><dt><code>{branch}</code>{index === 0 && <small>Protected</small>}</dt><dd><code>{sampleRepository.commits[index].sha}</code></dd></div>
              ))}</dl>
            </div>
          </article>,
          <article key="pink" className="github-card github-card--pink">
            <div><GitCommitHorizontal className="github-feature-icon" size={24} aria-hidden="true" /><h3>Inspect a commit</h3><p>Read the commit message and see who authored it, who committed it, and when.</p></div>
            <div className="github-panel">
              <h4><GitCommitHorizontal size={19} aria-hidden="true" /> {sampleRepository.commits[2].title}</h4>
              <div className="github-commit-layout">
                <ul className="github-commit-list" aria-label="Sample recent commits">
                  {[...sampleRepository.commits].reverse().map((commit, index) => (
                    <li key={commit.sha} className={index === 0 ? 'github-selected' : undefined}>
                      <strong>{commit.title}</strong><code>{commit.sha}</code>
                    </li>
                  ))}
                </ul>
                <dl><div><dt>Author</dt><dd>Alex Morgan</dd></div><div><dt>Committer</dt><dd>Jamie Chen</dd></div><div><dt>Committed</dt><dd>Apr 12, 10:24</dd></div><div><dt>SHA</dt><dd><code>{sampleRepository.commits[2].sha}</code></dd></div></dl></div>
            </div>
          </article>,
          <article key="green" className="github-card github-card--green">
            <div><FileCode className="github-feature-icon" size={24} aria-hidden="true" /><h3>Review code changes</h3><p>See which lines were added or removed in a changed file.</p></div>
            <div className="github-panel">
              <h4><FileCode size={19} aria-hidden="true" /> Changed files <small>Concept preview</small></h4>
              <div className="github-code-layout"><ul className="github-files"><li className="github-selected"><code>src/pages/Login.tsx</code></li><li><code>src/styles/auth.css</code></li></ul>
              <div className="github-code-preview"><div className="github-code-header"><code>Login.tsx</code><span><b>+2</b> <b>−1</b></span></div><pre className="github-diff" tabIndex={0} aria-label="Example diff for Login.tsx"><code>
                <span className="github-diff-removed">19 - {'<input type="email" />'}</span>
                <span className="github-diff-added">19 + {'<input type="email" aria-invalid={!!emailError} />'}</span>
                <span className="github-diff-added">20 + {'{emailError && <p role="alert">{emailError}</p>}'}</span>
              </code></pre></div></div>
            </div>
          </article>
  ];
  return (
    <>
      <section className="github-showcase" id="github" aria-labelledby="github-title">
        <div className="github-stage">
          <div className="github-heading-track"><header className="github-showcase-heading">
          <h2 id="github-title">Keep your code in view.</h2>{!mobile && <span className="github-step-count">{step + 1} of {Children.count(cards)}</span>}
        </header></div>
          {mobile ? <BentoGrid>{cards}</BentoGrid> : (
            <ScrollStack className="github-stack" pinTop="0px" peek={6} onStepChange={setStep}>
              {cards}
            </ScrollStack>
          )}

        </div>
      </section>
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
