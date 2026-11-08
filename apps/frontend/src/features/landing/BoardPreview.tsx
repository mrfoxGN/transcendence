import { sampleProject } from './sampleData';
import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, Bell, CalendarDays, ChevronDown, CircleCheck, FileText, Folder, Home, List, MoreHorizontal, Search, Settings,
  GitBranch, LayoutGrid, MessageSquare, MousePointer2, UsersRound,
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

const portraits: Record<string, string> = { AM: 'task', LN: 'team', SK: 'chat' };

function Portrait({ person }: { person: string }) {
  return <span className="board-portrait-fallback" aria-hidden="true">
    {person}
    <img className="board-portrait" src={`/team/${portraits[person]}.jpg`} alt="" width="22" height="22" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />
  </span>;
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

export function BoardPreview() {
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const finished = step === moves.length;
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
    observer.observe(grid.previousElementSibling ?? grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (finished) {
      const restart = window.setTimeout(() => setStep(0), 4500);
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
  }, [step, inView, finished]);

  return (
    <section className="preview section-wrap" aria-label="Interactive workspace preview">
      <div className="preview-window">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>DevUP</span>
          <span className="sample-label"><span /> Sample data</span>
        </div>
        <div className="workspace">
          <aside className="workspace-nav" aria-label="Sample workspace navigation">
            <div className="workspace-name"><span className="workspace-icon">D</span><span><strong>DevUP</strong><small>Developer workspace</small></span><ChevronDown size={13} /></div>
            <ul>{nav.map(({ icon: Icon, label }) => <li key={label} className={label === 'Board' ? 'selected' : ''}><Icon size={15} />{label}</li>)}</ul>
          </aside>
          <div className="board">
            <div className="board-app-bar">
              <img src="/devup.svg" alt="" width="32" height="32" />
              <span className="board-search-display"><Search size={15} /> Search tasks, issues, people or files</span>
              <span className="board-profile"><Bell size={16} aria-hidden="true" /><Portrait person="AM" /><strong>Alex Morgan</strong></span>
            </div>
            <div className="board-toolbar">
              <h2>Board <span className="board-members"><Portrait person="AM" /><Portrait person="LN" /><Portrait person="SK" /></span></h2>
              <div className="board-tools">
                <span className="wip" aria-label={`Work in progress: ${wip} of 3`}><span /> WIP <b>{wip} / 3</b></span>
              </div>
            </div>
            <div className="board-columns" ref={gridRef}>
              {columns.map(column => {
                const tasks = tasksFor(column);
                return <section data-column={column.label} key={column.label} className={`board-column column--${column.tone}`}>
                  <h3>{column.label}<span className="column-count">{tasks.length}</span><MoreHorizontal size={15} aria-hidden="true" /></h3>
                  <ul>{tasks.map(task => <TaskCard key={task.id} task={task} />)}</ul>
                </section>;
              })}
              <MousePointer2 ref={cursorRef} className="board-demo-cursor" aria-hidden="true" size={26} fill="#111" stroke="white" strokeWidth={1.5} />
            </div>
            <div className="demo-caption">
              {step > 0 ? <CircleCheck size={15} /> : <ArrowRight size={15} />} {step > 0 ? moves[step - 1].task.title + ' moved to ' + moves[step - 1].to + '.' : 'See how tasks move through the board.'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
