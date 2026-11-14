import { MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { ActivityList, FilterChips, Panel } from '../components';
import { activityItems } from '../previewData';
import type { PageHeading } from '../types';
import './activity.css';

type ActivityPageProps = {
  pageHeading: PageHeading;
  activityFilter: string;
  setActivityFilter: (filter: string) => void;
  activityFilterOpen: boolean;
  setActivityFilterOpen: (open: boolean) => void;
};

export function ActivityPage({
  pageHeading,
  activityFilter,
  setActivityFilter,
  activityFilterOpen,
  setActivityFilterOpen,
}: ActivityPageProps) {
  const shown = activityFilter === 'Tasks' ? activityItems.filter(item => item.action.includes('DEV-')) : activityItems;
  return <>{pageHeading(<button className="wu-button wu-button--secondary" type="button" onClick={() => setActivityFilterOpen(!activityFilterOpen)}><SlidersHorizontal size={15} />Filter activity</button>)}
    <div className="wu-activity-toolbar"><FilterChips items={['All activity', 'Tasks', 'GitHub', 'Files']} active={activityFilter} onChange={setActivityFilter} />{activityFilterOpen && <div className="wu-filter-popover"><strong>Filter activity</strong><label><input type="checkbox" defaultChecked /> Tasks and status changes</label><label><input type="checkbox" /> GitHub sync events</label><label><input type="checkbox" /> Files and notes</label><button className="wu-button wu-button--primary" type="button" onClick={() => { setActivityFilterOpen(false); setActivityFilter('Tasks'); }}>Apply filters</button></div>}</div>
    <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Today, Apr 12</h2><p>Recent updates from your workspace.</p></div><button className="wu-icon-button" type="button" aria-label="More activity options"><MoreHorizontal size={18} /></button></div><ActivityList items={shown} /></Panel></>;
}
