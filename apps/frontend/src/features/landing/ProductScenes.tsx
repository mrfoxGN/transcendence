import { useEffect, useRef } from 'react';
import { sampleProject } from './sampleData';
import { CalendarDays, Check, ClipboardList, FileText, Folder, MessageSquare, PanelRight, Paperclip } from 'lucide-react';

function TaskBadge() {
  return <span className="scene-task-badge">{sampleProject.taskId}</span>;
}

function SceneAvatar({ person }: { person: 'AM' | 'LN' | 'SK' }) {
  return <span className="board-portrait-fallback board-demo-avatar" data-person={person} aria-hidden="true">{person}</span>;
}

function TaskScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><PanelRight size={16} /> Board <span>/</span> Task detail <TaskBadge /></div>
      <div className="scene-content scene-preview-split">
        <div>
          <h4>{sampleProject.taskTitle}</h4>
          <p>Add inline validation and review the form at mobile widths.</p>
          <ul className="scene-checklist" aria-label="Task checklist">
            <li><Check size={14} aria-hidden="true" /> Add email and password fields</li>
            <li><Check size={14} aria-hidden="true" /> Show errors below the fields</li>
            <li><span aria-hidden="true" /> Review at mobile widths</li>
          </ul>
        </div>
        <dl className="scene-properties">
          <div><dt>Status</dt><dd><span className="scene-status"><i /> In progress</span></dd></div>
          <div><dt>Assignee</dt><dd className="scene-value"><SceneAvatar person="AM" /> Alex Morgan</dd></div>
          <div><dt>Due date</dt><dd className="scene-value"><CalendarDays size={13} aria-hidden="true" /> Apr 12</dd></div>
        </dl>
      </div>
    </div>
    <div className="scene-note"><MessageSquare size={17} /><div><strong>Review comment</strong><p>Can we show the error under the email field?</p></div></div>
  </div>;
}

function ChatScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><MessageSquare size={16} /> DevUP Team <span>/</span> General discussion</div>
      <div className="scene-content scene-chat">
        <span className="scene-date">Today · Apr 12</span>
        <div className="scene-message"><SceneAvatar person="LN" /><div><strong>Amina</strong> <small className="scene-time">10:24</small><p>The login form is ready for a mobile review.</p><TaskBadge /></div></div>
        <div className="scene-message scene-message--outgoing"><SceneAvatar person="AM" /><div><strong>Alex Morgan</strong> <small className="scene-time">10:28</small><p>Thanks, I’ll review it on mobile.</p></div></div>
        <div className="scene-composer"><Paperclip size={14} aria-hidden="true" /> Message DevUP Team</div>
      </div>
    </div>
    <div className="scene-note"><Check size={17} /><div><strong>Message sent</strong><p>Mobile review update · 10:28</p></div></div>
  </div>;
}

function FilesScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><Folder size={16} /> Files <span>/</span> Frontend <TaskBadge /></div>
      <div className="scene-content scene-preview-split">
        <div>
          <div className="scene-file scene-file--selected"><Paperclip size={18} /><div><strong>login-mobile.png</strong><small>PNG · 182 KB</small></div></div>
          <div className="scene-file"><FileText size={18} /><div><strong>Login review notes</strong><small>Workspace note</small></div></div>
        </div>
        <div className="scene-file-preview" aria-label="Sample login form screenshot">
          <div className="scene-file-screen"><strong>Sign in</strong><span>Email</span><span className="scene-file-input">alex@example.com</span><small>Enter a valid email address.</small></div>
          <div className="scene-value"><SceneAvatar person="SK" /><small>Added by Noah</small></div>
        </div>
      </div>
    </div>
    <div className="scene-note"><FileText size={17} /><div><div className="scene-task-meta"><strong>Review decision</strong><TaskBadge /></div><p>Keep the email error below the field.</p></div></div>
  </div>;
}

const scenes = [
  { id: 'task-detail', Icon: ClipboardList, label: 'Task detail', description: 'Open a card to see who owns it, where it stands, and what the team has discussed.', Preview: TaskScene },
  { id: 'team-chat', Icon: MessageSquare, label: 'Team chat', description: 'Share a progress update and coordinate the next review in workspace chat.', Preview: ChatScene },
  { id: 'notes-and-files', Icon: Folder, label: 'Notes and files', description: 'Keep review decisions and project files close to the task they belong to.', Preview: FilesScene },
];

export function ProductScenes() {
  const timeline = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timeline.current || !('IntersectionObserver' in window)) return;
    const previews = timeline.current.querySelectorAll<HTMLElement>('.story-artwork');
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.setAttribute('data-scene-motion', 'playing');
        observer.unobserve(target);
      }
    }, { threshold: .18 });

    for (const preview of previews) {
      if (!preview.hasAttribute('data-scene-motion')) preview.dataset.sceneMotion = 'waiting';
      observer.observe(preview);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <section className="product-stories" id="features" aria-labelledby="stories-heading">
      <div className="section-wrap">
        <div className="stories-heading" id="workflow">
          <h2 id="stories-heading">Follow a task <span className="aurora-text" data-slot="aurora-text">beyond the board.</span></h2>
        </div>
        <div className="story-timeline" ref={timeline}>
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


    </section>
  );
}
