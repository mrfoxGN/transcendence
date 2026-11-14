import { useEffect, useRef } from 'react';
import { sampleProject } from './sampleData';
import { ArrowUp, CalendarDays, Check, ClipboardList, FileText, Folder, Image, MessageSquare, PanelRight, Paperclip } from 'lucide-react';

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
            <li className="scene-checklist-focus"><span className="scene-checkmark"><Check size={13} role="img" aria-label="Complete" /></span> Review at mobile widths</li>
          </ul>
        </div>
        <dl className="scene-properties">
          <div><dt>Status</dt><dd><span className="scene-status"><i /> In progress</span></dd></div>
          <div><dt>Assignee</dt><dd><span className="scene-value scene-assignee"><SceneAvatar person="AM" /> Alex Morgan</span></dd></div>
          <div><dt>Due date</dt><dd className="scene-value"><CalendarDays size={13} aria-hidden="true" /> Apr 12</dd></div>
        </dl>
      </div>
    </div>
    <div className="scene-note scene-note--complete"><Check size={17} aria-hidden="true" /><div><strong>Checklist complete</strong><p>Mobile review finished</p></div></div>
  </div>;
}

function ChatScene() {
  return <div className="scene-stack">
    <div className="scene-window">
      <div className="scene-bar"><MessageSquare size={16} /> DevUP Team <span>/</span> General discussion</div>
      <div className="scene-content scene-chat">
        <span className="scene-date">Today · Apr 12</span>
        <div className="scene-message"><SceneAvatar person="LN" /><div><strong>Amina</strong> <small className="scene-time">10:24</small><p>Can you check the login form on mobile?</p></div></div>
        <div className="scene-message scene-message--outgoing"><SceneAvatar person="AM" /><div><strong>Alex Morgan</strong> <small className="scene-time">10:28</small><p>Mobile review done. Let’s keep the error below the email field.</p><TaskBadge /></div></div>
        <div className="scene-composer"><Paperclip size={14} aria-hidden="true" /> Message DevUP Team <span><ArrowUp size={14} aria-hidden="true" /></span></div>
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
          <div className="scene-file"><span className="scene-file-icon"><Image size={17} aria-hidden="true" /></span><div><strong>login-mobile.png</strong><small>PNG · 182 KB</small></div></div>
          <div className="scene-file scene-file--selected"><span className="scene-file-icon"><FileText size={17} aria-hidden="true" /></span><div><strong>Login review notes</strong><small>Workspace note</small></div></div>
        </div>
        <div className="scene-file-preview" aria-label="Sample login form screenshot">
          <div className="scene-file-screen"><strong>Sign in</strong><span>Email</span><span className="scene-file-input">alex@</span><small>Enter a valid email address.</small></div>
          <div className="scene-value"><SceneAvatar person="SK" /><small>Mobile review screenshot</small></div>
        </div>
      </div>
    </div>
    <div className="scene-note scene-note--decision"><FileText size={17} /><div><div className="scene-task-meta"><strong>Review decision</strong><TaskBadge /></div><p>Keep the email error below the field.</p></div></div>
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
