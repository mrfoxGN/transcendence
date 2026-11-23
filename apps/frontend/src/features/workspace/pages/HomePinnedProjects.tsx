import { ArrowUpRight } from 'lucide-react';
import { AvatarGroup } from '../WorkspaceControls';
import { useProjectPins } from '../useProjectPins';
import { projectAppearance } from '../project-appearance';
import { projectStatusLabels, type Project } from '../workspace-projects';
import type { Task } from '../types';
import type { Member } from '../workspace-tasks';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';

export function HomePinnedProjects({projects,failed,retry,workspaceId,profileId,tasks,members,onOpen,onBrowse}: {
  projects?:Project[];failed:boolean;retry:()=>void;workspaceId:string;profileId:string;tasks:Task[];members:Member[];onOpen:(id:string)=>void;onBrowse:()=>void;
}) {
  const {pinnedIds}=useProjectPins(workspaceId,profileId);
  const pinned=pinnedIds.flatMap(id=>projects?.filter(project=>project.id===id)??[]);
  return <section className="wu-home-pinned" aria-labelledby="home-pinned-title">
    <div className="wu-panel-heading"><h2 id="home-pinned-title">Pinned projects</h2><div className="wu-home-pinned-actions">
      <button className="wu-text-button" type="button" onClick={onBrowse}>All projects</button>
    </div></div>
    {failed?<div className="wu-home-pins-message" role="alert">Could not load projects. <button className="wu-text-button" type="button" onClick={retry}>Try again</button></div>
      :!projects?<div className="wu-home-pins-message" role="status">Loading projects…</div>
      :!projects.length?<div className="wu-home-pins-empty"><IllustratedEmptyState compact kind="projects" title="Your projects will live here" detail="Create a project to organize tasks and milestones." action="Explore projects" onAction={onBrowse}/></div>
      :!pinned.length?<div className="wu-home-pins-message"><span>Pin projects from the Projects page to keep them here.</span><button className="wu-text-button" type="button" onClick={onBrowse}>Choose projects</button></div>
      :<div className="wu-home-project-grid">{pinned.map((project,index)=>{
        const linked=new Set(project.tasks.map(task=>task.id));
        const assignees=new Set(tasks.filter(task=>linked.has(task.id)&&task.assigneeId).map(task=>task.assigneeId));
        if(project.ownerId)assignees.add(project.ownerId);
        const people=members.filter(member=>assignees.has(member.userId)).map(member=>({name:member.username,initials:member.username.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase(),preview:false}));
        const {done,total}=project.progress;const percent=total?Math.round(done/total*100):0;
        return <article className="wu-home-project-card" data-accent={index%3} style={projectAppearance(project.id)} key={project.id}>
          <div className="wu-home-project-top"><span className="wu-home-project-state">{projectStatusLabels[project.status]}</span></div>
          <h3><button type="button" onClick={()=>onOpen(project.id)}>{project.name}<ArrowUpRight size={15} aria-hidden="true"/></button></h3>
          <div className="wu-home-project-progress-copy"><span>{done} of {total} tasks complete</span><strong>{percent}%</strong></div>
          <progress value={done} max={Math.max(1,total)} aria-label={project.name+' completion'} aria-valuetext={done+' of '+total+' tasks complete'}/>
          <div className="wu-home-project-footer">{people.length?<AvatarGroup people={people} label="Project contributors"/>:<span>No contributors yet</span>}{project.targetDate&&<span>Due {new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(project.targetDate+'T12:00:00'))}</span>}</div>
        </article>;
      })}</div>}
  </section>;
}
