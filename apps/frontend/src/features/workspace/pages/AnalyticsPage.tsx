import { BarChart3, CheckCircle2, Clock3, GitBranch, Users } from 'lucide-react';
import { EmptyState, Panel, Pill, StatCard } from '../components';
import type { PageHeading } from '../types';
import './analytics.css';

type AnalyticsPageProps = {
  pageHeading: PageHeading;
  analyticsPeriod: string;
  setAnalyticsPeriod: (period: string) => void;
};

export function AnalyticsPage({
  pageHeading,
  analyticsPeriod,
  setAnalyticsPeriod,
}: AnalyticsPageProps) {
  const empty = analyticsPeriod === 'No activity';
  return <>{pageHeading(<select className="wu-select" aria-label="Analytics period" value={analyticsPeriod} onChange={event => setAnalyticsPeriod(event.target.value)}><option>Last 30 days</option><option>This week</option><option>No activity</option></select>)}{empty ? <Panel className="wu-content-panel"><EmptyState icon={<BarChart3 size={21} />} title="No activity in this period" detail="Try a wider date range to see how your workspace is moving." action="View last 30 days" onAction={() => setAnalyticsPeriod('Last 30 days')} /></Panel> : <>
    <div className="wu-stat-grid"><StatCard icon={<CheckCircle2 size={16} />} label="Tasks completed" value="24" note="6 more than last month" tone="mint" /><StatCard icon={<Clock3 size={16} />} label="Average cycle time" value="2.4 days" note="Across completed tasks" tone="violet" /><StatCard icon={<GitBranch size={16} />} label="Commits synced" value="38" note="Across 3 branches" tone="blue" /><StatCard icon={<Users size={16} />} label="Active members" value="5" note="All members this month" tone="pink" /></div>
    <div className="wu-analytics-grid"><Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Weekly throughput</h2><p>Tasks completed each week</p></div><Pill tone="mint">+18% this month</Pill></div><div className="wu-chart" role="img" aria-label="Weekly throughput chart"><div className="wu-chart-grid"><span>20</span><span>15</span><span>10</span><span>5</span><span>0</span></div><div className="wu-bars">{[['W1', 38], ['W2', 56], ['W3', 48], ['W4', 80], ['W5', 62], ['W6', 92], ['W7', 74], ['W8', 100]].map(([label, height]) => <div key={label}><i style={{ height: `${height}%` }} /><small>{label}</small></div>)}</div></div></Panel><Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Work by status</h2><p>Current tasks</p></div></div><div className="wu-status-summary">{[['To do', '2', 'neutral'], ['Ready', '2', 'blue'], ['In progress', '1', 'violet'], ['Review', '1', 'pink'], ['Done', '1', 'mint']].map(([label, count, tone]) => <div key={label}><span className={`wu-status-dot wu-status-dot--${tone}`} /><span>{label}</span><strong>{count}</strong></div>)}</div></Panel></div>
  </>}</>;
}
