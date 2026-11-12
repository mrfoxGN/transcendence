import { Check, GitBranch, MessageSquare, Paperclip } from 'lucide-react';

export function TeamWorkflow() {
  return <figure className="orbit-stage" aria-label="Tasks, team conversations, and GitHub connected around a shared DevUP workspace. Illustrative sample data.">
    <div className="orbit-ring orbit-ring--outer" /><div className="orbit-ring orbit-ring--inner" />
    <div className="orbit-plate orbit-plate--back" /><div className="orbit-plate orbit-plate--front" />
    <div className="orbit-hub"><img src="/devup.svg" alt="" width="64" height="64" /><strong>DevUP</strong><span>Everything, connected.</span></div>
    <div className="orbit-card orbit-task"><div className="orbit-card-label"><span className="orbit-icon"><Check size={18} /></span> A clear next step <span className="orbit-dots">•••</span></div><small>DEV-12</small><strong>Build login page</strong><div className="orbit-task-bottom"><span className="tag tag--violet">In progress</span><span className="avatar avatar--blue">AM</span></div></div>
    <div className="orbit-card orbit-chat"><div className="orbit-card-label"><span className="orbit-icon"><MessageSquare size={18} /></span> Team chat</div><div className="orbit-message"><img src="/team/chat.jpg" alt="" /><div><strong>Amina</strong><p>Login page is taking shape!</p></div></div><span className="orbit-reply">Let’s review it together.</span></div>
    <div className="orbit-card orbit-github"><span className="orbit-icon"><GitBranch size={22} /></span><div><strong>Code meets context.</strong><small>storefront / feat/login</small><span>3 stored commits</span></div></div>
    <div className="orbit-file"><Paperclip size={17} /><span>Login review notes</span><Check size={15} /></div>
    <div className="orbit-avatar orbit-avatar--one"><img src="/team/board.jpg" alt="" /></div><div className="orbit-avatar orbit-avatar--two"><img src="/team/team.jpg" alt="" /></div>
  </figure>;
}
