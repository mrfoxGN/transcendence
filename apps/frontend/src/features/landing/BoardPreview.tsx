import { sampleProject } from './sampleData';
import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, Bell, CalendarDays, ChevronDown, CircleCheck, Check, FileText, Folder, Home, List, MoreHorizontal, Search, Settings,
  GitBranch, LayoutGrid, MessageSquare, MousePointer2, Trash2, UsersRound,
} from 'lucide-react';

type Task = { id: string; title: string; tag: string; tone: string; initials: string };
type Column = { label: string; tone: string; tasks: Task[] };

const loginTask: Task = { id: sampleProject.taskId, title: sampleProject.taskTitle, tag: 'Frontend', tone: 'violet', initials: 'AM' };
const columns: Column[] = [
  { label: 'To Do', tone: 'neutral', tasks: [
    { id: 'DEV-18', title: 'Design new onboarding flow', tag: 'Design', tone: 'violet', initials: 'LN' },
    { id: 'DEV-19', title: 'Draft workspace welcome screen', tag: 'UX', tone: 'blue', initials: 'SK' },
    { id: 'DEV-20', title: 'Review project setup', tag: 'Design', tone: 'violet', initials: 'AM' },
  ] },
  { label: 'Ready', tone: 'blue', tasks: [
    loginTask, { id: 'DEV-14', title: 'Add workspace empty state', tag: 'Design', tone: 'blue', initials: 'SK' },
  ] },
  { label: 'In Progress', tone: 'violet', tasks: [
    { id: 'DEV-08', title: 'Set up workspace navigation', tag: 'Frontend', tone: 'violet', initials: 'SK' },
  ] },
  { label: 'Done', tone: 'green', tasks: [] },
];

const moves = [
  { task: loginTask, from: 'Ready', to: 'In Progress' },
  { task: columns[2].tasks[0], from: 'In Progress', to: 'Done' },
];

const nav = [
  { icon: Home, label: 'Home' }, { icon: List, label: 'Backlog' },
  { icon: LayoutGrid, label: 'Board' }, { icon: GitBranch, label: 'GitHub' },
  { icon: Activity, label: 'Activity' }, { icon: UsersRound, label: 'Team' },
  { icon: MessageSquare, label: 'Chat' }, { icon: Folder, label: 'Files' },
  { icon: FileText, label: 'Notes' }, { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

const features = [
  { nav: 'Backlog', caption: 'Review and prioritize tasks before they reach the board.' },
  { nav: 'Chat', caption: 'Follow DEV-12 in the team conversation.' },
  { nav: 'Activity', caption: 'See recent updates and activity across the workspace.' },
  { nav: 'Files', caption: 'Browse shared folders and open a file’s details.' },
] as const;

function Portrait({ person }: { person: string }) {
  return <span className="board-portrait-fallback board-demo-avatar" data-person={person} aria-hidden="true">{person}</span>;
}

function TourCursor() {
  return <span className="board-tour-cursor" aria-hidden="true">
    <MousePointer2 size={23} fill="#111827" stroke="white" strokeWidth={1.5} />
  </span>;
}

function BoardFeature({ page }: { page: typeof features[number]['nav'] }) {
  const [phase, setPhase] = useState(0);
  const reply = 'Thanks, I’ll review DEV-12 on mobile.';

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const delays = page === 'Activity' ? [600, 1550, 2900] : page === 'Backlog' ? [1300, 2250, 3400] : [1350, 2350];
    const timers = delays.map((delay, index) => window.setTimeout(() => setPhase(index + 1), delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [page]);
  if (page === 'Backlog') return (
    <div className="board-tour-page">
      <div className="board-tour-filters"><b>All</b><span>Features</span><span>Bug fixes</span><span>Documentation</span><span className="board-tour-meta">{phase === 3 ? "5 sample tasks" : "6 sample tasks"}</span></div>
      <div className="board-tour-table-wrap"><table className="board-tour-table">
        <thead><tr><th scope="col"><span className="sr-only">Selection</span></th><th>ID</th><th>Task</th><th>Label</th><th>Priority</th><th>Assignee</th></tr></thead>
        <tbody>{columns.flatMap(column => column.tasks).filter(task => phase !== 3 || task.id !== "DEV-14").map((task, index) => (
          <tr key={task.id} className={`board-tour-enter${phase > 0 && task.id === "DEV-14" ? " board-tour-row-selected" : ""}`} style={{ animationDelay: `${index * 65}ms` }}>
            <td><span className="board-tour-checkbox" data-checked={phase > 0 && task.id === "DEV-14"} aria-hidden="true">{phase > 0 && task.id === "DEV-14" && <Check size={11} />}</span></td><td>{task.id}</td>
            <td className={task.id === 'DEV-14' ? 'board-tour-target' : undefined}>
              <strong>{task.title}</strong>
              {task.id === 'DEV-14' && <><small>Duplicate of the workspace setup task</small>{phase === 0 && <TourCursor />}</>}
            </td><td><span className="tag tag--blue">{task.tag}</span></td>
            <td><span className="board-tour-priority">{index % 3 === 0 ? 'High' : 'Medium'}</span></td><td><Portrait person={task.initials} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="board-tour-feedback" aria-hidden="true">
        {phase === 1 && <span className="board-tour-delete board-tour-enter board-tour-target"><Trash2 size={14} /> 1 task selected · Delete task <TourCursor /></span>}
        {phase === 2 && <div className="board-tour-confirm board-tour-enter">
          <strong>Delete DEV-14?</strong>
          <p>Add workspace empty state will be removed from the backlog.</p>
          <span className="board-tour-delete board-tour-target"><Trash2 size={14} /> Delete task <TourCursor /></span>
        </div>}
        {phase === 3 && <span className="board-tour-success board-tour-enter"><CircleCheck size={14} /> DEV-14 removed from the backlog</span>}
      </div>
    </div>
  );

  if (page === 'Chat') return (
    <div className="board-tour-page board-tour-chat">
      <div className="board-tour-panel board-tour-chat-side"><strong>Conversations</strong><p className="board-tour-selected">DevUP Team <small>2 unread</small></p><p>Frontend</p><p>Design review</p></div>
      <div className="board-tour-panel">
        <div className="board-tour-panel-title"><MessageSquare size={16} /><strong>DevUP Team</strong><small>5 members · General discussion</small></div>
        <div className="board-tour-message board-tour-enter"><Portrait person="LN" /><div><strong>Amina</strong> <small>10:24</small><p>The login form is ready for a mobile review.</p><span className="tag tag--violet">{sampleProject.taskId}</span></div></div>
        <div className="board-tour-message board-tour-enter" style={{ animationDelay: '220ms' }}><Portrait person="SK" /><div><strong>Noah</strong> <small>10:27</small><p>I’ll check the email error on a narrow screen.</p></div></div>
        {phase === 2 && <div className="board-tour-message board-tour-sent board-tour-enter"><Portrait person="AM" /><div><strong>Alex Morgan</strong><p>{reply}</p><small>Sent · 10:28</small></div></div>}
        <div className="board-tour-composer board-tour-target">
          <MessageSquare size={13} /> {phase === 1 ? reply : 'Message DevUP Team'} <span className="tag tag--blue">Send</span><TourCursor />
        </div>
      </div>
      <div className="board-tour-panel board-tour-chat-side"><strong>Details</strong><p>Workspace updates and review notes</p><strong>Members</strong><div className="board-tour-people"><Portrait person="AM" /><Portrait person="LN" /><Portrait person="SK" /></div></div>
    </div>
  );

  if (page === 'Activity') {
    const events = [
      { id: 'sent', task: sampleProject.taskId, text: 'sent a mobile review update', time: '10:28', taskEvent: false },
      { id: 'deleted', task: 'DEV-14', text: 'removed Add workspace empty state from the backlog', time: '10:26', taskEvent: true },
      { id: 'moved', task: sampleProject.taskId, text: 'moved Build login page', time: '10:24', taskEvent: true },
    ];
    const visibleEvents = phase === 0 ? events.slice(2) : phase >= 2 ? events.filter(event => event.taskEvent) : events;

    return (
      <div className="board-tour-page board-tour-split">
        <div>
          <div className="board-tour-filters">
            <span className={phase < 2 ? 'board-tour-selected' : undefined}>All</span>
            <span className={phase >= 2 ? 'board-tour-target board-tour-selected' : 'board-tour-target'}>Tasks{phase < 2 && <TourCursor />}</span>
            <span>Comments</span><span>Files</span><span className="board-tour-meta">Last 7 days</span>
          </div>
          <div className="board-tour-panel">
            <span className="tag tag--blue">Today · Apr 12</span>
            {visibleEvents.map(event => (
              <div key={event.id} className={event.id === 'moved' ? 'board-tour-message board-tour-enter board-tour-target' : 'board-tour-message board-tour-enter'}>
                <Portrait person="AM" />
                <div><strong>Alex Morgan</strong><p>{event.text}</p><small>{event.time} · {event.task}</small>
                  {event.id === 'moved' && phase >= 2 && <span className="board-tour-activity-pointer"><TourCursor /></span>}
                  {event.id === 'moved' && phase === 3 && <div className="board-tour-document board-tour-enter">
                    <strong>Status changed</strong><p><span className="tag tag--blue">Ready</span> → <span className="tag tag--violet">In Progress</span></p>
                    <small>Moved by Alex Morgan · Apr 12 at 10:24</small>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      <div className="board-tour-panel"><strong>Activity overview</strong>
        <div className="board-tour-stats">{['48 Total activities', '14 Task updates', '18 Comments', '6 Files'].map(stat => <div key={stat}>{stat}</div>)}</div>
        <strong>Activity timeline</strong>
        <div className="board-tour-chart board-tour-target" aria-label="Sample activity timeline">{[34, 62, 45, 75, 56, 82, 100].map((height, index) => <span key={index} className="board-tour-enter" style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }} />)}</div><div className="board-tour-chart-labels"><span>Apr 6</span><span>Apr 9</span><span>Apr 12</span></div>
      </div>
    </div>
  );
  }

  return (
    <div className="board-tour-page board-tour-split">
      <div>
        <div className="board-tour-filters"><b>All</b><span>Documents</span><span>Images</span><span>Design</span></div>
        <div className="board-tour-folders">{['Design', 'Documentation', 'Frontend', 'Backend'].map((name, index) => <div key={name} className="board-tour-panel board-tour-enter" style={{ animationDelay: `${index * 70}ms` }}><Folder size={18} /><div><strong>{name}</strong><small>{[12, 8, 24, 16][index]} files</small></div></div>)}</div>
        <div className="board-tour-table-wrap"><table className="board-tour-table"><thead><tr><th>Name</th><th>Type</th><th>Shared with</th></tr></thead><tbody>
          <tr className="board-tour-selected"><td className="board-tour-target"><strong>Project Requirements.pdf</strong><small>Documentation · 2.4 MB</small><TourCursor /></td><td>PDF</td><td><Portrait person="AM" /></td></tr>
          <tr><td><strong>login-mobile.png</strong></td><td>PNG</td><td><Portrait person="LN" /></td></tr>
        </tbody></table></div>
      </div>
      <div className="board-tour-panel board-tour-file-detail board-tour-enter" style={{ animationDelay: '1.35s' }}>
        <div className="board-tour-file-cover" /><strong>Project Requirements.pdf</strong><p>2.4 MB · PDF</p><span className="tag tag--blue">{phase === 1 ? "Opening PDF…" : "Open preview"}</span>
        <span className="tag tag--blue">Details</span><p>Project scope, milestones, and technical requirements.</p>
        <p>Location · Documentation</p><p>Owner · Alex Morgan</p><strong>Shared with</strong><div className="board-tour-people"><Portrait person="AM" /><Portrait person="LN" /><Portrait person="SK" /></div>
        {phase === 2 && <div className="board-tour-document board-tour-enter">
          <small>PDF preview · Page 1 of 3</small>
          <h3>Project requirements</h3>
          <p><strong>01 · Login flow</strong></p>
          <p>Validate email and password, and display feedback directly below each field.</p>
        </div>}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <li className="task-card" data-task={task.id}>
      <span className="board-task-reference"><span className="task-id">{task.id}</span><MoreHorizontal size={14} aria-hidden="true" /></span>
      <strong>{task.title}</strong>
      <div className="task-meta">
        <span className={`tag tag--${task.tone}`}>{task.tag}</span>
        <span className="board-task-people"><Portrait person={task.initials} /><CalendarDays size={13} aria-hidden="true" /><time dateTime="2027-04-12">Apr 12</time></span>
      </div>
    </li>
  );
}

export function BoardPreview({ ready }: { ready: boolean }) {
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const featureIndex = step - moves.length;
  const feature = features[featureIndex];
  const wip = tasksFor(columns[2]).length;

  function tasksFor(column: Column) {
    let tasks = column.tasks;
    for (const move of moves.slice(0, step)) {
      if (column.label === move.from) tasks = tasks.filter(task => task.id !== move.task.id);
      if (column.label === move.to) tasks = [move.task, ...tasks];
    }
    return tasks;
  }

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
    // Watch the toolbar so the demo can start on phones with a tall board.
    observer.observe(grid.closest(".board")?.querySelector(".board-toolbar") ?? grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !ready) return;
    if (step >= moves.length) {
      const restart = window.setTimeout(() => setStep(featureIndex + 1 === features.length ? 0 : step + 1), 5200);
      return () => window.clearTimeout(restart);
    }
    const grid = gridRef.current;
    const cursor = cursorRef.current;
    const move = moves[step];
    const card = grid?.querySelector<HTMLElement>(`[data-task="${move.task.id}"]`);
    const target = grid?.querySelector<HTMLElement>(`[data-column="${move.to}"] ul`);
    if (!grid || !cursor || !card || !target) return;

    const origin = grid.getBoundingClientRect();
    const start = card.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const x = start.left - origin.left + 24;
    const y = start.top - origin.top + 20;
    const dx = end.left - start.left;
    const dy = end.top - start.top;
    const point = (left: number, top: number) => `translate(${left}px, ${top}px)`;
    const timing = { duration: 2000, fill: 'both' as const };
    const dragEase = 'cubic-bezier(.42, 0, .58, 1)';
    const pointerMotion = cursor.animate([
      { transform: point(x - 32, y - 22), opacity: 0, easing: 'ease-in-out', offset: 0 },
      { transform: point(x, y), opacity: 1, offset: .3 },
      { transform: point(x, y), opacity: 1, offset: .42, easing: dragEase },
      { transform: point(x + dx, y + dy), opacity: 1, easing: 'ease-in-out', offset: .88 },
      { transform: point(x + dx, y + dy), opacity: 0, offset: 1 },
    ], timing);
    const cardMotion = card.animate([
      { transform: 'none', zIndex: 3, offset: 0 },
      { transform: 'none', zIndex: 3, offset: .42, easing: dragEase },
      { transform: point(dx, dy), zIndex: 3, offset: .88 },
      { transform: point(dx, dy), zIndex: 3, offset: 1 },
    ], timing);
    const cardBlur = card.animate([
      { filter: 'blur(0)', offset: 0 },
      { filter: 'blur(0)', offset: .42, easing: 'ease-in' },
      { filter: 'blur(.85px)', offset: .65, easing: 'ease-out' },
      { filter: 'blur(0)', offset: .88 },
      { filter: 'blur(0)', offset: 1 },
    ], timing);
    pointerMotion.onfinish = () => {
      setStep(step + 1);
    };

    return () => {
      pointerMotion.cancel();
      cardMotion.cancel();
      cardBlur.cancel();
    };
  }, [step, featureIndex, inView, ready]);

  return (
    <section className="preview" aria-label="Interactive workspace preview">
      <div className="preview-window">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>DevUP</span>
          <span className="sample-label"><span /> Sample data</span>
        </div>
        <div className="workspace">
          <aside className="workspace-nav" aria-label="Sample workspace navigation">
            <div className="workspace-name"><span className="workspace-icon">D</span><span><strong>DevUP</strong><small>Developer workspace</small></span><ChevronDown size={13} /></div>
            <ul>{nav.map(({ icon: Icon, label }) => <li key={label} className={(feature?.nav ?? 'Board') === label ? 'selected' : ''}><Icon size={15} />{label}</li>)}</ul>
          </aside>
          <div className="board">
            <div className="board-app-bar">
              <img src="/devup.svg" alt="" width="32" height="32" />
              <span className="board-search-display"><Search size={15} /> Search tasks, issues, people or files</span>
              <span className="board-profile"><Bell size={16} aria-hidden="true" /><Portrait person="AM" /><strong>Alex Morgan</strong></span>
            </div>
            <div className="board-toolbar">
              <h2>{feature?.nav ?? "Board"} <span className="board-members" hidden={!!feature}><Portrait person="AM" /><Portrait person="LN" /><Portrait person="SK" /></span></h2>
              <div className="board-tools" hidden={!!feature}>
                <span className="wip" aria-label={`Work in progress: ${wip} of 3`}><span /> WIP <b>{wip} / 3</b></span>
              </div>
            </div>
            <div className="board-demo-stage">
            <div className="board-columns" ref={gridRef} hidden={!!feature}>
              {columns.map(column => {
                const tasks = tasksFor(column);
                return <section data-column={column.label} key={column.label} className={`board-column column--${column.tone}`}>
                  <h3>{column.label}<span className="column-count">{tasks.length}</span><MoreHorizontal size={15} aria-hidden="true" /></h3>
                  <ul>{tasks.map(task => <TaskCard key={task.id} task={task} />)}</ul>
                </section>;
              })}
              <MousePointer2 ref={cursorRef} className="board-demo-cursor" aria-hidden="true" size={26} fill="#111" stroke="white" strokeWidth={1.5} />
            </div>
            {feature && <BoardFeature key={feature.nav} page={feature.nav} />}
            </div>
            <div className="demo-caption">
              {step > 0 ? <CircleCheck size={15} /> : <ArrowRight size={15} />} {feature ? feature.caption : step > 0 ? moves[step - 1].task.title + ' moved to ' + moves[step - 1].to + '.' : 'See how tasks move through the board.'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
