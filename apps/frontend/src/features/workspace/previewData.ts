import type { Task } from './types';

export const seedTasks: Task[] = [
  { id: 'DEV-27', title: 'Polish mobile board layout', status: 'To do', type: 'Bug fix', person: 'Alex Morgan', initials: 'AM', due: 'Apr 16', priority: 'High', description: 'Tighten the board columns and preserve useful task details on narrow screens.' },
  { id: 'DEV-31', title: 'Update workspace onboarding', status: 'To do', type: 'Docs', person: 'Omar Idrissi', initials: 'OI', due: 'Apr 17', priority: 'Medium', description: 'Make the first workspace setup easier to understand for new teams.' },
  { id: 'DEV-24', title: 'Add empty workspace state', status: 'Ready', type: 'Feature', person: 'Maya Rodriguez', initials: 'MR', due: 'Apr 14', priority: 'Medium', description: 'Give teams a clear next step when their workspace has no activity yet.' },
  { id: 'DEV-34', title: 'Retry file deletion', status: 'Ready', type: 'Tech debt', person: 'Omar Idrissi', initials: 'OI', due: 'Apr 18', priority: 'Low', description: 'Make file deletion safe to retry after a temporary storage error.' },
  { id: 'DEV-12', title: 'Build login page', status: 'In progress', type: 'Feature', person: 'Alex Morgan', initials: 'AM', due: 'Apr 12', priority: 'High', description: 'Finish the responsive login flow and add clear validation feedback.' },
  { id: 'DEV-18', title: 'Review GitHub sync flow', status: 'Review', type: 'Feature', person: 'Sarah Kim', initials: 'SK', due: 'Apr 12', priority: 'High', description: 'Check repository permissions and make sync results easier to understand.' },
  { id: 'DEV-08', title: 'Set up workspace navigation', status: 'Done', type: 'Feature', person: 'Sarah Kim', initials: 'SK', due: 'Apr 10', priority: 'Low', description: 'Create a shared navigation pattern for workspace pages.' },
];

export const activityItems = [
  { initials: 'SK', name: 'Sarah Kim', action: 'moved DEV-18 to Review', time: '12 min ago', color: 'violet' },
  { initials: 'OI', name: 'Omar Idrissi', action: 'synced studio-north / storefront', time: '34 min ago', color: 'mint' },
  { initials: 'MR', name: 'Maya Rodriguez', action: 'added login-mobile.png', time: '1 hour ago', color: 'pink' },
  { initials: 'AM', name: 'Alex Morgan', action: 'updated the DEV-12 checklist', time: '2 hours ago', color: 'blue' },
  { initials: 'LN', name: 'Lina Noor', action: 'created a note in Workspace setup', time: '3 hours ago', color: 'orange' },
];

export const people = [
  { initials: 'AM', name: 'Alex Morgan', role: 'Workspace owner', email: 'alex@studionorth.dev', status: 'Active', color: 'mint' },
  { initials: 'SK', name: 'Sarah Kim', role: 'Product designer', email: 'sarah@studionorth.dev', status: 'Active', color: 'violet' },
  { initials: 'OI', name: 'Omar Idrissi', role: 'Backend developer', email: 'omar@studionorth.dev', status: 'Active', color: 'blue' },
  { initials: 'MR', name: 'Maya Rodriguez', role: 'Frontend developer', email: 'maya@studionorth.dev', status: 'Active', color: 'pink' },
  { initials: 'JC', name: 'Jamie Chen', role: 'QA engineer', email: 'jamie@studionorth.dev', status: 'Invited', color: 'orange' },
];

export const files = [
  { id: 'f1', name: 'login-mobile.png', kind: 'Image', size: '182 KB', owner: 'Maya Rodriguez', date: 'Apr 12', task: 'DEV-12', color: 'pink' },
  { id: 'f2', name: 'Workspace setup', kind: 'Note', size: '4 KB', owner: 'Alex Morgan', date: 'Apr 11', task: 'DEV-31', color: 'orange' },
  { id: 'f3', name: 'api-contract.pdf', kind: 'PDF', size: '640 KB', owner: 'Omar Idrissi', date: 'Apr 10', task: 'DEV-34', color: 'blue' },
  { id: 'f4', name: 'board-flow.fig', kind: 'Design', size: '2.1 MB', owner: 'Sarah Kim', date: 'Apr 9', task: 'DEV-27', color: 'violet' },
];

export const noteItems = [
  { title: 'Workspace setup', meta: 'Updated today · Alex Morgan', text: 'Keep onboarding focused on the first team task. Ask for a workspace name, then offer a quick way to invite collaborators.' },
  { title: 'Login review notes', meta: 'Updated yesterday · Sarah Kim', text: 'The email error should appear directly below the field. Keep the submit button available while the user corrects the address.' },
  { title: 'Board defaults', meta: 'Updated Apr 10 · Omar Idrissi', text: 'Use five default columns and a working limit of three for In progress.' },
];

export const taskStatuses = ['To do', 'Ready', 'In progress', 'Review', 'Done'];

export const statusTones: Record<string, string> = { Ready: 'blue', 'In progress': 'violet', Review: 'pink', Done: 'mint' };

export const homeFilters = ['Assigned to me', 'Due this week', 'All tasks'];

export const previewWeek = new Set(['Apr 12', 'Apr 14', 'Apr 16', 'Apr 17']);
