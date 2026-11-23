import {Bell,Check,ShieldCheck,UsersRound} from 'lucide-react';
import type {Theme} from './PersonalSettings';

function MiniScreen({dark=false}:{dark?:boolean}){
  return <span className="wu-settings-mini-screen" data-theme={dark?'dark':'light'}><span className="wu-preview-sidebar"><i/><i/><i/><i/></span><span className="wu-preview-page"><span className="wu-preview-topline"/><span className="wu-preview-metrics"><i/><i/><i/></span><span className="wu-preview-chart"><i/><i/><i/><i/><i/></span><span className="wu-preview-lines"><i/><i/></span></span></span>;
}
export function ThemePreview({mode}:{mode:Theme}){
  return <span className={'wu-settings-theme-preview wu-settings-theme-preview--'+mode} aria-hidden="true">{mode==='system'?<><span className="wu-settings-theme-half wu-settings-theme-half--light"><MiniScreen/></span><span className="wu-settings-theme-half wu-settings-theme-half--dark"><MiniScreen dark/></span></>:<MiniScreen dark={mode==='dark'}/>}</span>;
}
export function NotificationPreview({badge}:{badge:boolean}){
  return <figure className="wu-settings-notification-preview"><figcaption>Notification preview</figcaption><div className="wu-notification-sample-top"><span>DevUP</span><span className="wu-notification-sample-bell"><Bell size={19} aria-hidden="true"/>{badge&&<b aria-label="Example: 3 unread notifications">3</b>}</span></div><div className="wu-notification-sample-message"><span className="wu-notification-sample-avatar" aria-hidden="true">AM</span><div><strong>A new task update</strong><p>Your team’s latest updates appear here.</p></div><span>Now</span></div><p className="wu-notification-preview-caption">{badge?'Unread counts appear on the bell.':'The bell appears without an unread count.'}</p></figure>;
}
export function BoardSettingsPreview({limit}:{limit:number}){
  return <figure className="wu-settings-board-preview"><figcaption>How your board works <span>Example</span></figcaption><div className="wu-settings-mini-board">{['Ready','In progress','Review'].map((name,index)=><div key={name} data-active={index>0}><span>{name}</span><i/><i className="wu-mini-task-short"/></div>)}</div><p><Check size={13} aria-hidden="true"/>In progress and Review share your limit of {limit}.</p></figure>;
}
export function AccessPreview({ownerName}:{ownerName?:string}){
  return <div className="wu-settings-access-diagram" role="list" aria-label="Workspace roles"><div role="listitem"><span className="wu-access-role-mark" aria-hidden="true"><ShieldCheck size={20}/></span><div><strong>Owner</strong><span>{ownerName??'Workspace owner'}</span><p>Manages workspace settings and access.</p></div></div><span className="wu-access-role-connector" aria-hidden="true"/><div role="listitem"><span className="wu-access-role-mark wu-access-role-mark--member" aria-hidden="true"><UsersRound size={20}/></span><div><strong>Members</strong><p>Collaborate on tasks, projects, and discussions.</p></div></div></div>;
}
