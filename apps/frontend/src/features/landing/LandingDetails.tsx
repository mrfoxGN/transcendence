import { sampleRepository } from './sampleData';
import { ScrollStack } from './ScrollStack';
import './github-showcase.css';
import { FileCode, GitBranch, GitCommitHorizontal, Github, Plus } from 'lucide-react';

const questions = [
  { question: 'How does the work-in-progress limit work?', answer: 'The board counts tasks in In Progress and Review. When the workspace reaches its limit, the team needs to finish active work before starting another ready task.' },
  { question: 'Can I connect a GitHub repository?', answer: 'A workspace owner can link one eligible public repository through GitHub authorization. Workspace members can view branches and stored commits and manually refresh recent commits. The browser handoff for first-time setup is still in development.' },
  { question: 'Can I talk to someone outside the workspace chat?', answer: 'Yes. Direct messages are separate from workspace chat, so you can continue a private conversation while switching between workspaces.' },
];

export function LandingDetails() {
  return (
    <>
      <section className="github-showcase" id="github" aria-labelledby="github-title">
        <header className="github-showcase-heading section-wrap">
          <Github size={36} aria-hidden="true" />
          <h2 id="github-title">Keep your code in view.</h2>
        </header>
        <ScrollStack className="github-stack" pinTop="0px" peek={14}>
          <article className="github-card github-card--blue">
            <div><h3>Connect a repository</h3><p>Bring a public GitHub repository into your DevUP workspace.</p></div>
            <div className="github-panel">
              <h4><Github size={19} aria-hidden="true" /> {sampleRepository.name}</h4>
              <dl><div><dt>Visibility</dt><dd>Public</dd></div><div><dt>Default branch</dt><dd><code>{sampleRepository.branches[0]}</code></dd></div><div><dt>Last sync</dt><dd>2 minutes ago</dd></div></dl>
            </div>
          </article>
          <article className="github-card github-card--violet">
            <div><h3>Browse branches</h3><p>See active branches, their latest commits, and which branches are protected.</p></div>
            <div className="github-panel">
              <h4><GitBranch size={19} aria-hidden="true" /> Branches</h4>
              <dl>{sampleRepository.branches.map((branch, index) => (
                <div key={branch}><dt><code>{branch}</code>{index === 0 && <small>Protected</small>}</dt><dd><code>{sampleRepository.commits[index].sha}</code></dd></div>
              ))}</dl>
            </div>
          </article>
          <article className="github-card github-card--pink">
            <div><h3>Inspect a commit</h3><p>Read the commit message and see who authored it, who committed it, and when.</p></div>
            <div className="github-panel">
              <h4><GitCommitHorizontal size={19} aria-hidden="true" /> {sampleRepository.commits[2].title}</h4>
              <dl><div><dt>Author</dt><dd>Alex Morgan</dd></div><div><dt>Committer</dt><dd>Jamie Chen</dd></div><div><dt>Committed</dt><dd>Apr 12, 10:24</dd></div><div><dt>SHA</dt><dd><code>{sampleRepository.commits[2].sha}</code></dd></div></dl>
            </div>
          </article>
          <article className="github-card github-card--green">
            <div><h3>Review code changes</h3><p>See which lines were added or removed in a changed file.</p></div>
            <div className="github-panel">
              <h4><FileCode size={19} aria-hidden="true" /> Changed files <small>Concept preview</small></h4>
              <ul className="github-files"><li><code>src/pages/Login.tsx</code></li><li><code>src/styles/auth.css</code></li></ul>
              <pre className="github-diff" tabIndex={0} aria-label="Example diff for Login.tsx"><code>
                <span className="github-diff-removed">19 - {'<input type="email" />'}</span>
                <span className="github-diff-added">19 + {'<input type="email" aria-invalid={!!emailError} />'}</span>
                <span className="github-diff-added">20 + {'{emailError && <p role="alert">{emailError}</p>}'}</span>
              </code></pre>
            </div>
          </article>
        </ScrollStack>
      </section>
      <section className="faq section-wrap" aria-labelledby="faq-title">
        <div className="section-intro"><h2 id="faq-title">Questions about DevUP</h2></div>
        <div className="faq-list">{questions.map(({ question, answer }) => (
          <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>
        ))}</div>
      </section>
    </>
  );
}
