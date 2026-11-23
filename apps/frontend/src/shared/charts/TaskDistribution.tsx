import {ChartTooltipSurface} from './ChartTooltipSurface';
import {useId} from 'react';
import type {Task} from '../../features/workspace/types';
import {IllustratedEmptyState} from '../illustrations/EmptyIllustration';
export function TaskDistribution({tasks,onOpenBoard}:{tasks:Task[];onOpenBoard:()=>void}){
 const id=useId();const labels=['To do','Ready','In progress','Review','Done'];const counts=labels.map(s=>tasks.filter(t=>t.status===s).length);const max=Math.max(1,...counts);
 return <section className="wu-panel devup-distribution"><div className="wu-panel-heading"><div><h2>Work by stage</h2><p>Where your team’s tasks stand today</p></div><button className="wu-text-button" onClick={onOpenBoard}>View board</button></div>
 {!tasks.length?<IllustratedEmptyState compact kind="analytics" title="Your progress will appear here" detail="Create a task to start seeing the shape of your work."/>:<ChartTooltipSurface><svg viewBox="0 0 620 230" role="img" aria-labelledby={id}><desc id={id}>{labels.map((s,i)=>s+': '+counts[i]).join(', ')}</desc>{[0,1,2].map(n=><line key={n} x1="25" x2="600" y1={45+n*65} y2={45+n*65} stroke="var(--chart-grid)" strokeDasharray="3 5"/>)}{labels.map((name,i)=><g key={name} tabIndex={0} role="img" aria-label={name+': '+counts[i]+' tasks'} data-chart-label={name} data-chart-detail={counts[i]+' '+(counts[i]===1?'task':'tasks')}><rect x={45+i*114} y={175-counts[i]/max*125} width="54" height={counts[i]/max*125} rx="7" fill={'var(--chart-'+['todo','ready','progress','review','done'][i]+')'}/><text x={72+i*114} y={163-counts[i]/max*125} textAnchor="middle" className="devup-chart-value">{counts[i]}</text><text x={72+i*114} y="207" textAnchor="middle">{name === 'In progress' ? <><tspan x={72+i*114}>In</tspan><tspan x={72+i*114} dy="20">progress</tspan></> : name}</text></g>)}</svg></ChartTooltipSurface>}
 </section>;
}
