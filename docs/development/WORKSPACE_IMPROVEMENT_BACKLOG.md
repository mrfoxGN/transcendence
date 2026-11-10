# DevUP workspace improvement backlog

This backlog covers signup and login, the workspace picker, and all signed-in workspace pages. It starts with the issues that give users incomplete or misleading information, then moves through daily task work, onboarding, delivery, and collaboration.

The findings come from a frontend and backend source audit. API wiring was inspected. The local frontend did not respond during the audit, and the backend test command could not start because Jest was unavailable in the checkout. The [backend handoff](WORKSPACE_BACKEND_HANDOFF.md) records earlier smoke tests and the current backend contracts.

## How to work through it

- Pick one unchecked ticket at a time. Start with **WU-01**. Keep the ticket ID in the branch, PR, or issue title.
- Use the checkbox to track completion. Close a ticket after its acceptance check passes and the PR records the verification.
- Copy the [implementation prompt](#implementation-prompts) for the ticket you picked. Each prompt carries enough context to start a separate coding session.
- `FRONTEND` uses the existing API. `FRONTEND + BACKEND` requires changes on both sides. `DISCOVERY` produces a proposal for later implementation. Split larger tickets into smaller PRs under the same ID.
- The first batch is **WU-01 through WU-04**. WU-02 covers the shared Files and Notes pagination problem and can ship in separate PRs. WU-03 can ship the direct-message count before the workspace read cursor. WU-05 fixes invitation copy now and leaves the complete signup-to-invite flow to WU-15.

## 1. Fix incorrect and incomplete behavior

| Ticket | Change | Acceptance check |
| --- | --- | --- |
| [ ] **WU-01 · Task creation feedback** · `FRONTEND` | The create handler stores API errors, but the task form does not show them. Render the error beside the form, keep the draft, show `Creating…`, and guard repeat submission. | A full column, invalid input, or dropped connection leaves the draft intact with an actionable error. A rapid double submit creates one task. [Create flow](../../apps/frontend/src/features/WorkspaceApp.tsx) |
| [ ] **WU-02 · Complete Files and Notes browsing** · `FRONTEND + BACKEND` | Both collections load one API page, which defaults to 20 items. Add pagination and server-side search and sorting. Fetch file deep links by ID through the existing endpoint. Use a direct resource lookup for note links when WU-19 adds them. | With at least 25 items in each collection, the oldest item can be found and opened. Sorting covers the whole collection. An older file opens from its copied link and downloads with the correct filename. Missing and inaccessible files have a recovery state. [Files service](../../apps/backend/src/modules/files/services/files.service.ts) · [Notes service](../../apps/backend/src/modules/notes/services/notes.service.ts) |
| [ ] **WU-03 · Real unread counts for Chat** · `FRONTEND + BACKEND` | Remove the hard-coded Chat badge. Wire the existing direct-message unread counts to the sidebar, then persist a per-user workspace-channel read cursor. Keep the voice and video controls visible. | Two clients agree on unread counts after opening a conversation, reloading, and reconnecting. Reading a thread updates its count and the sidebar. Zero unread leaves no numeric badge. [Workspace shell](../../apps/frontend/src/features/WorkspaceApp.tsx) · [Chat client](../../apps/frontend/src/features/workspace/workspace-chat.ts) |
| [ ] **WU-04 · Filter Activity across the full feed** · `FRONTEND + BACKEND` | Activity filters the current page after fetching it. Apply event category, actor, and date filters before pagination. Reset to page one when a filter changes and return explicit next-page metadata. | A file event beyond the first unfiltered page appears when filtering for files. Empty results, retry, and the final page render correctly. [Activity page](../../apps/frontend/src/features/workspace/pages/ActivityPage.tsx) · [Activity service](../../apps/backend/src/modules/activities/services/activities.service.ts) |
| [ ] **WU-05 · Explain current invitation requirements** · `FRONTEND` | The invitation API looks up an existing DevUP account. Explain that requirement in the form and give a useful next step when the email is unknown. | An owner can distinguish an unknown account, a pending invitation, and an existing member. The email remains in the form after a recoverable error. [Invitation service](../../apps/backend/src/modules/workspaces/services/workspaces.service.ts) |
| [ ] **WU-06 · Consistent deadlines and date filters** · `FRONTEND + BACKEND` | The date picker serializes local midnight to an instant. Store date-only deadlines as calendar dates and plan migration of existing values. Define workspace timezone for reports. Use the same overdue rules across pages and call a rolling seven-day filter **Next 7 days**. | Two users in different timezones see the same date-only deadline. Tests cover today, overdue, the seven-day boundary, a daylight-saving change, and existing records. [Task editor](../../apps/frontend/src/features/workspace/TaskDetails.tsx) · [Date helpers](../../apps/frontend/src/features/workspace/workspace-tasks.ts) |

## 2. Make daily task work faster

| Ticket | Change | Acceptance check |
| --- | --- | --- |
| [ ] **WU-07 · Home and My work** · `FRONTEND` | Separate personal work from workspace totals. Rank Needs attention by blocked and overdue severity, show reasons, and add **View all**. Make metric links open views that match their counts. Keep the current bar labeled **Workspace progress** until projects exist. | Every clickable metric opens a matching result set. Needs attention explains why each task appears and exposes the full queue. Empty and newly created workspaces have clear next actions. |
| [ ] **WU-08 · Backlog views and sorting** · `FRONTEND + BACKEND` | Clarify the To do and Ready scope with **All backlog tasks**, or add a separate all-status view. Add sorting by priority, due date, and manual rank. Use assignee IDs and an explicit **Unassigned** option. Preserve filters and search when opening a task, add **Clear filters**, and persist named views such as My work, Needs review, and Blocked. | Two people with the same display name filter separately. Returning from a task restores the previous view. A saved view reopens with the same scope and ordering. |
| [ ] **WU-09 · Reliable Kanban ordering and column management** · `FRONTEND + BACKEND` | Persist card order within columns. Explain valid moves and full destinations before dropping. Keep a keyboard and touch-friendly **Move to** action. Add **Rename** to the column menu alongside double-click. Provide **Move tasks, then delete column** with a preview and transaction. Distinguish a board column from its workflow status. | Reordering survives reload. Keyboard and touch users can move cards. Concurrent moves respect capacity. A failed column deletion or migration leaves tasks and column layout intact. |
| [ ] **WU-10 · Task identity, quick create, and editing** · `FRONTEND + BACKEND` | Add readable stable task IDs and **Copy link**. Support reassignment in one step and optional assignee, priority, and due date in quick create. For existing fields, show **Saving**, **Saved**, and **Couldn’t save** with retry and retained input. Keep explicit actions for creating, sending, and irreversible changes. | Old task links still work. Failed edits remain recoverable after a retry. A task can be assigned or reassigned without clearing the existing assignee first. |
| [ ] **WU-11 · Task attachments and practical bulk actions** · `FRONTEND + BACKEND` | Use the existing task-linked upload API in the task drawer. Show related files in both directions. Add row selection only when it enables bulk reassignment, priority, or status changes. Define how partial failures are reported. | An authorized teammate can upload and open a task attachment after reload. An unauthorized account cannot download it. A batch with one rejected change names the failed task and reports what succeeded. |
| [ ] **WU-12 · Task structure and history** · `FRONTEND + BACKEND` | Add reusable checklists, then subtasks and labels. Show task history for meaningful changes and make ready/done definitions available where tasks move. Clarify whether those definitions are guidance or enforced requirements. | Checklist completion survives reload. Subtasks link to parents. History records who changed what and when. Any enforced rule gives a clear reason and recovery path. |
| [ ] **WU-13 · Command palette and deep links** · `FRONTEND + BACKEND` | Add **Create task**, **Go to My work**, **Switch workspace**, recent items, and readable task IDs. Add Files and Notes search after WU-02. Resolve task links independently of the current board view when needed. | Keyboard users can invoke, search, select, and exit the palette with focus restored. A link opens its exact resource after reload or explains why the resource is unavailable. |

## 3. Improve onboarding and administration

| Ticket | Change | Acceptance check |
| --- | --- | --- |
| [ ] **WU-14 · First-run experience and account recovery** · `FRONTEND + BACKEND` | Add an optional avatar step after signup and a create-or-join choice. Give an empty workspace one useful next action. Add password reset, email verification, and return to the requested destination after sign-in. | A new person can skip the avatar, create a workspace, and add a task. Recovery handles invalid and expired links. Verify duplicate email, invalid credentials, and password-manager autofill. |
| [ ] **WU-15 · End-to-end invitations and team management** · `FRONTEND + BACKEND` | Add expiring email invitations for unregistered people. Preserve invite context through signup and login. Add team search, pending status, expiry, resend, leave, and ownership transfer. Define owner/admin/member/guest permissions before adding roles. Specify what removal does to assignments and live subscriptions. | An unregistered invitee signs up and reaches the invited workspace. Expired, revoked, and reused links are handled. An outsider and a removed member cannot access resources over REST or realtime connections. |
| [ ] **WU-16 · Workspace picker, navigation, and settings** · `FRONTEND + BACKEND` | Add workspace search and recent access as workspace counts grow. Preserve collapsed navigation tooltips and visible focus. Distinguish workspace switching from account switching. Separate personal settings for profile, avatar, security, theme, and notifications from workspace settings for access, board rules, integrations, timezone, and archive. Define which operations archive blocks. | An archived workspace is identifiable after opening a direct link. Allowed and blocked mutations agree between UI and API. Personal preferences do not change another user’s settings. |

## 4. Connect planning, delivery, and reporting

| Ticket | Change | Acceptance check |
| --- | --- | --- |
| [ ] **WU-17 · Projects and milestones** · `FRONTEND + BACKEND` | Introduce projects with an owner, target date, status, milestones, and linked tasks. Keep workspace-wide progress separate from per-project progress. | A teammate can open a project from a task, inspect milestone work, and reconcile progress with its linked tasks. Existing tasks remain accessible without a project. |
| [ ] **WU-18 · GitHub connection and pull-request context** · `FRONTEND + BACKEND` | Explain current repository eligibility before OAuth. Show last successful sync, sync failures, reconnect, and disconnect. Link pull requests to readable task IDs and show PR status in the task drawer. Then add signed, deduplicated webhooks and opt-in transition rules. Scope private and multiple repositories separately. | A live GitHub account can connect, sync, recover from revoked access, and disconnect. A linked PR appears on its task. Replayed webhook deliveries cannot repeat a transition. |
| [ ] **WU-19 · Files and Notes as shared reference material** · `FRONTEND + BACKEND` | Add file type/uploader filters, upload progress, the visible 10 MiB limit, safe previews, rename, and task backlinks. Add note search, pins, author and updated time, copyable links, task references, and clear edit permissions. Add conflict handling and revision restore before realtime editing. Add folders when file volume warrants them. | Files can be located by metadata. Only supported file types preview. Two editors cannot silently overwrite one another. An authorized user can restore a note revision. |
| [ ] **WU-20 · Actionable workspace history** · `FRONTEND + BACKEND` | After WU-04, emit assignment, blocker, note, board-settings, and GitHub events. Use descriptive resource actions and identify deleted items. Give admin and security events a separate audit trail with its own permissions. | Each supported event filter has real data. A resource link opens the right item, and deleted resources have an explicit state. Audit-only events are restricted to authorized roles. |
| [ ] **WU-21 · Trustworthy Analytics** · `FRONTEND + BACKEND` | Separate current open, overdue, and active counts from period-based reporting. Add drill-down and a data-table view. Use stored status history to calculate time in progress, time in review, and cumulative flow. Define treatment of reopened, cancelled, and deleted tasks. | Known task timelines produce the expected totals and stage durations. Chart counts match the drill-down. Changing the reporting period affects the intended metrics only. |

## 5. Improve collaboration and notification quality

| Ticket | Change | Acceptance check |
| --- | --- | --- |
| [ ] **WU-22 · Personal notification inbox** · `FRONTEND + BACKEND` | Add assignment, mention, followed-task comment, and relevant status notifications. Add task watching, categories, preferences, and persistent invitation outcomes. Keep personal updates distinct from workspace Activity. | An assignment or mention generates one notification for the intended person. The link opens the exact task or conversation. Read state and invitation outcomes survive reload. |
| [ ] **WU-23 · Chat reliability** · `FRONTEND + BACKEND` | Preserve scroll while reading older messages. Show **Jump to latest**, connection state, and retry. Keep drafts per conversation. Use cursor-based history and idempotent message sending. | Incoming messages do not pull the reader away from older content. Retrying a send after a network interruption produces one message. Reconnect recovers missed history. |
| [ ] **WU-24 · Chat collaboration** · `FRONTEND + BACKEND` | Add replies, mentions, message search, and permission-checked attachments. Add reactions after those workflows are reliable. | A reply keeps its message context. A mention reaches only its intended participant. Search finds older messages. Attachment access follows conversation membership after reload and when links are copied. |
| [ ] **WU-25 · Later product extensions** · `DISCOVERY` | Evaluate voice/video, custom fields, workflow automation, and advanced roadmaps against actual team usage. Voice/video requires authorized session signaling and a media stack. | Each extension has a user problem, an owner, an agreed scope, and acceptance checks before implementation. |

## Implementation prompts

### WU-01 · Task creation feedback

**Scope** `FRONTEND`

**Status** Implemented. The production build and mocked handler checks passed for blank titles, duplicate submissions, full-column rejection, network failure, and successful retry. Browser verification is pending.

> Implement WU-01 in DevUP. Trace the create-task form and handler in `WorkspaceApp.tsx`. Render API errors inside the task dialog, retain the entered title and description on failure, show a pending state, and guard rapid duplicate submission. Preserve successful creation and refresh behavior. Verify rejection from a full column, invalid input, a failed request, and a double submit. Use the existing API.

### WU-02 · Complete Files and Notes browsing

**Scope** `FRONTEND + BACKEND`

**Status** Implemented. Files searches filenames and Notes searches titles across the workspace. The production frontend build and backend suite passed. Browser and live API verification with more than 20 records remain pending.

> Implement WU-02 in DevUP. Trace the Files and Notes list endpoints and their frontend collection callers. Add pagination and server-side search and sorting with stable ordering and permission checks. Resolve file links through the existing file-by-ID endpoint independently of the current list page. Preserve existing upload, edit, and delete flows. Verify with at least 25 files and 25 notes, including an older file link and a link the viewer cannot access. Split Files and Notes into separate changes if needed.

### WU-03 · Real unread counts for Chat

**Scope** `FRONTEND + BACKEND`

**Status** Implemented with voice and video controls visible. The frontend and backend builds passed. A rolled-back two-user MySQL check verified read persistence, unread counts, same-timestamp ordering, and outsider denial. Two-browser verification is pending.

> Implement WU-03 in DevUP. Replace the hard-coded sidebar Chat badge with the existing direct-message unread counts and hide it when there are zero unread messages. Add a persistent per-user workspace-channel read cursor, counting only messages the viewer can access. Keep the voice and video controls visible. Verify that counts agree across two clients after opening a conversation, reloading, and reconnecting. The direct-message badge can ship before the workspace cursor.

### WU-04 · Filter Activity across the full feed

**Scope** `FRONTEND + BACKEND`

**Status** Implemented. The Activity page uses `GET /workspaces/:workspaceId/activities/page` for filtered results and next-page metadata. Both builds and 593 backend tests passed. A rolled-back MySQL check verified older matches, combined filters, date boundaries, and empty and final pages. Browser verification is pending.

> Implement WU-04 in DevUP. Move category, actor, and date filtering into the workspace Activity API before pagination. Return explicit next-page metadata, preserve compatibility for existing consumers, and reset the frontend to page one when filters change. Verify that a matching event beyond the first unfiltered page is found and that empty results, failed requests, and the last page are handled correctly.

### WU-05 · Explain current invitation requirements

**Scope** `FRONTEND`

> Implement WU-05 in DevUP’s invite dialog. Explain that the email must belong to an existing DevUP account, and use the existing API responses to distinguish an unknown account, pending invitation, and existing member. Keep the email on recoverable failure and show a clear next step. Verify each error and a successful invite. Leave the unregistered-invite flow to WU-15.

### WU-06 · Consistent deadlines and date filters

**Scope** `FRONTEND + BACKEND`

> Implement WU-06 in DevUP. Trace how due dates are stored and displayed, then migrate date-only deadlines to calendar dates without silently shifting existing values. Define the workspace timezone for reporting and share due-date rules across Home, Backlog, Board, and Analytics. Label the rolling filter “Next 7 days.” Verify existing records, two viewer timezones, today and overdue cutoffs, the seven-day boundary, and a daylight-saving transition.

### WU-07 · Home and My work

**Scope** `FRONTEND`

> Implement WU-07 on DevUP Home. Separate My work from workspace totals, rank Needs attention by blocked and overdue severity, show a reason on each row, and provide View all. Make metric links open a view whose results match the count. Keep Workspace progress scoped to the workspace. Verify matching counts and destinations, and useful states for new workspaces and users with no assigned tasks.

### WU-08 · Backlog views and sorting

**Scope** `FRONTEND + BACKEND`

> Implement WU-08 in DevUP Backlog. Make the To do and Ready scope explicit, add priority, due-date, and manual ordering, and filter assignees by stable ID with an Unassigned option. Add Clear filters and preserve search, filters, and sort when returning from a task. Persist named views such as My work, Needs review, and Blocked. Verify duplicate display names, restored navigation state, and saved views after reload. Coordinate manual ordering with WU-09.

### WU-09 · Reliable Kanban ordering and column management

**Scope** `FRONTEND + BACKEND`

> Implement WU-09 in DevUP Board. Persist card order within columns and preserve existing transition and work-in-progress rules. Explain invalid moves and full columns, provide a keyboard and touch Move to action, and expose Rename in the column menu. Add an owner-authorized move-then-delete flow for populated columns with a preview and atomic update. Verify reload, keyboard and touch moves, concurrent capacity checks, and rollback after a failed deletion.

### WU-10 · Task identity, quick create, and editing

**Scope** `FRONTEND + BACKEND`

> Implement WU-10 in DevUP. Add stable readable task IDs and Copy link while keeping legacy task links valid. Add optional assignee, priority, and due date to quick create, and allow reassignment in one step. Show autosave progress and errors, retain failed input, and provide retry. Keep explicit actions for creation, posting, and irreversible operations. Verify link compatibility, failed-save recovery, and reassignment.

### WU-11 · Task attachments and practical bulk actions

**Scope** `FRONTEND + BACKEND`

> Implement WU-11 in DevUP. Wire the existing task-linked upload API into the task drawer and add backlinks from file details. Add task selection only alongside supported bulk changes for assignee, priority, or status. Preserve per-task permission and workflow rules, and report partial success by task. Verify attachments after reload, denied downloads for outsiders, and a batch containing a rejected update.

### WU-12 · Task structure and history

**Scope** `FRONTEND + BACKEND`

> Implement WU-12 in DevUP in stages. Start with reusable task checklists and persisted completion, then add subtasks, labels, and a task history showing meaningful changes with actor and time. Surface definitions of ready and done near status moves and clarify whether they are guidance or enforced rules. Verify checklist persistence, parent navigation, accurate history, and actionable rule rejection.

### WU-13 · Command palette and deep links

**Scope** `FRONTEND + BACKEND`

> Implement WU-13 in DevUP’s command palette. Add Create task, Go to My work, Switch workspace, recent items, and readable task IDs when available. After WU-02, include permission-scoped Files and Notes search. Resolve direct task links independently of the current board view and show a useful unavailable state. Verify keyboard selection, Escape and focus restoration, exact resource links, and missing or unauthorized resources.

### WU-14 · First-run experience and account recovery

**Scope** `FRONTEND + BACKEND`

> Implement WU-14 in DevUP’s auth and onboarding routes. Add a skippable avatar step after signup, a clear create-or-join choice, and a first-task action in a new workspace. Add email verification and password reset with expiring tokens. Restore the requested DevUP destination after sign-in and validate redirect targets. Verify skipping the avatar, duplicate email, invalid credentials, expired recovery links, and password-manager autofill. Keep marketing changes outside scope.

### WU-15 · End-to-end invitations and team management

**Scope** `FRONTEND + BACKEND`

> Implement WU-15 in DevUP. Add expiring, revocable email invitations for unregistered users and preserve invite context through signup and login. Add team search, invitation status and resend, leaving, and ownership transfer. Define a permission matrix before adding admin and guest roles. Define how removing someone affects assignments and live subscriptions. Verify invite acceptance by a new account, expired and revoked links, and access denial for outsiders and removed members over REST and realtime connections.

### WU-16 · Workspace picker, navigation, and settings

**Scope** `FRONTEND + BACKEND`

> Implement WU-16 in DevUP. Add workspace search and recent access, preserve labels and keyboard focus in collapsed navigation, and distinguish workspace switching from account switching. Separate personal and workspace settings. Define archive behavior, display it when opening an archived workspace directly, and enforce the same mutation rules on the API and frontend. Verify role-based settings, direct archive links, and preference isolation between users.

### WU-17 · Projects and milestones

**Scope** `FRONTEND + BACKEND`

> Implement WU-17 in DevUP. Add a lightweight project model with an owner, target date, status, milestones, and linked tasks. Keep workspace progress distinct from project progress and allow existing tasks to remain ungrouped. Verify that a teammate can navigate from a task to its project, inspect milestone work, and reconcile progress with the linked tasks.

### WU-18 · GitHub connection and pull-request context

**Scope** `FRONTEND + BACKEND`

> Implement WU-18 in DevUP. First clarify repository eligibility, show last successful sync and sync failures, and add owner-authorized reconnect and disconnect. Then link pull requests to stable task IDs and show PR status in the task drawer. Add signature verification, delivery deduplication, and opt-in status rules for webhooks. Keep private and multiple repositories as separately scoped work. Verify live OAuth, revoked access, disconnect, task linking, and replayed delivery.

### WU-19 · Files and Notes as shared reference material

**Scope** `FRONTEND + BACKEND`

> Implement WU-19 after WU-02. Add file type and uploader filters, upload progress, the visible 10 MiB limit, safe supported previews, rename, and task backlinks. Add note search, pins, author and updated metadata, copyable links, task references, and clear edit permissions. Add conflict handling and revision restore before realtime editing. Verify metadata search, unsupported file types, concurrent note edits, and authorized restore.

### WU-20 · Actionable workspace history

**Scope** `FRONTEND + BACKEND`

> Implement WU-20 after WU-04. Emit meaningful events for assignments, blockers, notes, board settings, and GitHub sync. Give each event a descriptive action and handle deleted resources. Separate admin and security events into a permission-restricted audit trail. Verify that each visible filter has real events, live links open the right resource, deleted targets have a clear state, and unauthorized accounts cannot access audit events.

### WU-21 · Trustworthy Analytics

**Scope** `FRONTEND + BACKEND`

> Implement WU-21 in DevUP Analytics. Separate current snapshots from date-range reports and provide task drill-downs and a readable chart data table. Use stored status history for time in progress, time in review, and cumulative flow. Document workspace timezone and how reopened, cancelled, and deleted tasks count. Verify with known task timelines, reconcile chart and drill-down totals, and confirm the period selector affects only period metrics.

### WU-22 · Personal notification inbox

**Scope** `FRONTEND + BACKEND`

> Implement WU-22 in DevUP. Add notifications for assignments, mentions, followed-task comments, and relevant status changes. Add task watching, categories, preferences, and persistent invitation outcomes. Keep personal notifications separate from workspace Activity and avoid duplicate delivery on retry. Verify one correctly targeted notification, exact resource navigation, and persistent read and invitation states.

### WU-23 · Chat reliability

**Scope** `FRONTEND + BACKEND`

> Implement WU-23 in DevUP Chat. Preserve the reading position when incoming messages arrive above the fold and show Jump to latest when the user is away from the bottom. Add connection status and retry, retain drafts per conversation, use cursor-based history, and make sends idempotent. Verify reconnect catch-up, pagination while new messages arrive, preserved scroll and drafts, and one delivered message after retry.

### WU-24 · Chat collaboration

**Scope** `FRONTEND + BACKEND`

> Implement WU-24 after WU-23. Add replies with source-message context, participant-scoped mentions, message search, and conversation-authorized attachments. Add reactions after these flows are reliable. Verify reply links, mention targeting, older search results, and attachment access after reload, with copied links, and from an outsider account.

### WU-25 · Later product extensions

**Scope** `DISCOVERY`

> Produce a short discovery brief for DevUP covering voice/video, custom fields, workflow automation, and advanced roadmaps. For each, identify the user problem, evidence of demand, minimum useful scope, proposed owner, dependencies, and acceptance checks. Include authorization, signaling, and media infrastructure in the voice/video scope. Rank the extensions and leave implementation for a separately scoped ticket.

## Release verification

- Use three accounts: a workspace owner, a member, and an outsider. Exercise signup, invite acceptance, task assignment, file upload, transition to Review, notifications, and resource links.
- Reload and reconnect both signed-in sessions. Confirm task updates, unread counts, and links still behave correctly.
- Verify denied actions through the API as well as the UI. Include cross-workspace resource access, removed members, private conversation attachments, and owner-only settings.
- Exercise at least 25 records, a full column, a failed save, a duplicate send, a stale deep link, a long title or filename, and a non-default timezone.
- Check desktop and mobile widths, keyboard-only navigation, visible focus, drawer focus restoration, reduced motion, and light and dark themes.
- Record the tested build and scenarios in the PR. Run the relevant automated tests and keep earlier smoke-test results separate from new verification.

## Product references

- **Linear** for saved queues, projects, milestones, and pull-request links. [Custom views](https://linear.app/docs/custom-views) · [Projects](https://linear.app/docs/projects) · [GitHub integration](https://linear.app/docs/github-integration)
- **ClickUp** for quick-create defaults and bulk edits. [Create tasks from views](https://help.clickup.com/hc/en-us/articles/31463619842711-Create-a-task-from-views) · [Bulk actions](https://help.clickup.com/hc/en-us/articles/6309768265495-Manage-tasks-with-the-Bulk-Action-Toolbar)
- **Jira** for historical Kanban reporting and bottleneck analysis. [Kanban reports](https://support.atlassian.com/jira-software-cloud/docs/generate-a-report/) · [Cumulative flow](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-cumulative-flow-diagram/)
- **Notion** for collection views, side-peek details, and note recovery. [Views and side peek](https://www.notion.com/help/views-filters-and-sorts) · [Version history](https://www.notion.com/en-gb/help/duplicate-delete-and-restore-content)
- **Trello** for lightweight task checklists. [Card checklists](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/)
- **Slack** for unread indicators, thread context, and notification controls. [Threaded replies](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions-) · [Notification behavior](https://slack.com/help/articles/360025446073-Guide-to-Slack-notifications-Guide-to-Slack-notifications)
