import { sampleProject } from './sampleData';
import { Check, ClipboardList, FileText, Folder, MessageSquare, PanelRight, Paperclip } from 'lucide-react';

function TaskScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><PanelRight size={16} /> {sampleProject.workspace} <span>/</span> {sampleProject.taskId}</div>
      <div className="scene-content">
        <span className="scene-status"><i /> In progress</span>
        <h4>{sampleProject.taskTitle}</h4>
        <p>Add email and password fields, with clear validation messages.</p>
        <div className="scene-person"><img src="/team/chat.jpg" alt="" /><div><strong>Amina</strong><small>Assignee</small></div></div>
      </div>
    </div>
    <div className="scene-note"><MessageSquare size={17} /><div><strong>Task comment</strong><p>Can we show the error under the email field?</p></div></div>
  </div>;
}

function ChatScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><MessageSquare size={16} /> Workspace chat <span>/</span> Studio North</div>
      <div className="scene-content scene-chat">
        <div className="scene-message"><img src="/team/chat.jpg" alt="" /><div><strong>Amina</strong><p>DEV-12 is taking shape. The login form is in progress.</p></div></div>
        <div className="scene-message"><img src="/team/board.jpg" alt="" /><div><strong>Noah</strong><p>I'll check it on a narrow screen this afternoon.</p></div></div>
      </div>
    </div>
    <div className="scene-note"><Check size={17} /><div><strong>DEV-12</strong><p>Build login page in progress</p></div></div>
  </div>;
}

function FilesScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><Folder size={16} /> Notes and files <span>/</span> Studio North</div>
      <div className="scene-content">
        <div className="scene-file"><FileText size={22} /><div><strong>Login review notes</strong><small>Workspace note</small></div></div>
        <div className="scene-file"><Paperclip size={22} /><div><strong>login-mobile.png</strong><small>Workspace file</small></div></div>
      </div>
    </div>
    <div className="scene-note"><FileText size={17} /><div><strong>{sampleProject.taskId} review decision</strong><p>Keep the email error below the field.</p></div></div>
  </div>;
}

const scenes = [
  { id: 'task-detail', Icon: ClipboardList, label: 'Task detail', description: 'Open a card to see who owns it, where it stands, and what the team has discussed.', Preview: TaskScene },
  { id: 'team-chat', Icon: MessageSquare, label: 'Team chat', description: 'Share a progress update and coordinate the next review in workspace chat.', Preview: ChatScene },
  { id: 'notes-and-files', Icon: Folder, label: 'Notes and files', description: 'Keep review decisions and project files close to the task they belong to.', Preview: FilesScene },
];

export function ProductScenes() {
  return (
    <section className="product-stories" id="features" aria-labelledby="stories-heading">
      <div className="section-wrap">
        <div className="stories-heading" id="workflow">
          <h2 id="stories-heading">Follow a task <span>beyond the board.</span></h2>
        </div>
        <div className="story-timeline">
          {scenes.map(({ id, Icon, label, description, Preview }) => (
            <section className="story-step" key={id} aria-labelledby={id}>
              <div className="story-step-copy">
                <Icon className="story-step-icon" size={54} strokeWidth={1.8} stroke={`url(#${id}-gradient)`} aria-hidden="true">
                  <defs>
                    <linearGradient id={`${id}-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop stopColor="var(--hero-blue)" />
                      <stop offset="50%" stopColor="var(--hero-violet)" />
                      <stop offset="100%" stopColor="var(--hero-pink)" />
                    </linearGradient>
                  </defs>
                </Icon>
                <h3 id={id}>{label}</h3>
                <p>{description}</p>
              </div>
              <div className="story-artwork"><Preview /></div>
            </section>
          ))}
        </div>
      </div>
      <section className="story-closing" aria-labelledby="closing-heading">
        <div className="section-wrap">
          <img src="/devup.svg" alt="" width="48" height="48" />
          <h2 id="closing-heading">Your next idea starts here.</h2>
          <a className="button button--secondary" href="/register">Create an account</a>
        </div>
      </section>

    </section>
  );
}
