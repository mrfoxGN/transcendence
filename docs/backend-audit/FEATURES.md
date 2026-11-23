# Implemented features and integration rules

Scope: audited `main` at `d401454`. Every route listed here exists in the
[complete HTTP catalog](HTTP_API.md). Payload decorators and full response DTOs
are in [DTO reference](DTO_REFERENCE.md).

## Transport, authentication and errors

- Nest listens on `APP_PORT` (default 3000), without a global business-route prefix.
- Browser requests use `/api/auth/...`, `/api/workspaces/...`, etc. Existing
  [Nginx configuration](../../apps/frontend/nginx.conf) strips `/api/` before
  proxying to Nest. Vite forwards `/api/...` to that proxy and forwards Socket.IO.
  A direct request to Nest uses `/auth/...`, not `/api/auth/...`.
- Nest Swagger is mounted at native `/api` (`/api-json` for its default JSON).
  These are middleware routes, separate from the 112 controller operations. Via
  the stripping application proxy they are `/api/api` and `/api/api-json`.
- No explicit HTTP CORS enablement exists in `main.ts`; retain same-origin proxying.
- Global validation enables `whitelist`, `forbidNonWhitelisted`, and `transform`.
  Unknown fields on validated DTOs cause 400. Raw scalar/body handlers have their
  own checks; do not assume a universal validation schema for them.
- Protected routes use `Authorization: Bearer <accessToken>`; guards validate
  signature, active user, and token version. UUID route parameters are validated.
- Most responses are direct JSON arrays/objects. Do not add a global `data` unwrap.
  Handle 204 and empty-body responses before attempting JSON parsing. Some void
  handlers have default 200 because no `@HttpCode(204)` is declared.
- Surface 400 validation/recovery information, 401 sign-in expiry, 403 permission
  limits, 404 unavailable resources, 409 workflow/conflict errors, 413 uploads,
  and upstream/email availability errors. Never replace failures with fake data.

## Authentication and personal account

Source: [AuthController](../../apps/backend/src/modules/auth/controllers/auth.controller.ts),
[AuthService](../../apps/backend/src/modules/auth/services/auth.service.ts),
[UsersService](../../apps/backend/src/modules/users/services/users.service.ts).

| Capability | Native API | Frontend behavior |
|---|---|---|
| Registration | `POST /auth/register` | `{username,email,password}`; returns user, not session token |
| Password login | `POST /auth/login` | `{email,password}`; handle token OR two-factor challenge |
| Email 2FA login | `POST /auth/login/2fa` | `{twoFactorToken,code}`; successful response supplies `accessToken` |
| Resend 2FA login code | `POST /auth/login/2fa/resend` | `{twoFactorToken}`; 204; respect resend feedback/cooldown |
| Current account | `GET /auth/profile` | User DTO includes verified-email state, 2FA, theme and notification badge |
| Logout | `POST /auth/logout` | Revokes token version and disconnects user sockets; clear local session |
| Change password | `PATCH /auth/password` | `{currentPassword,newPassword}`; 204; session/socket handling must follow revocation |
| Request verification | `POST /auth/email-verification/request` | Authenticated; 204; sends email code when needed |
| Confirm verification | `POST /auth/email-verification/confirm` | `{code}`; 204; refresh profile after success |
| Request password recovery | `POST /auth/password-reset/request` | `{email}`; 204; non-enumerating response |
| Confirm password recovery | `POST /auth/password-reset/confirm` | `{email,code,newPassword}`; 204; return to sign-in |
| Begin enabling 2FA | `POST /auth/2fa/request-enable` | Verified account email required; 204 |
| Confirm enabling 2FA | `POST /auth/2fa/confirm-enable` | `{code}`; returns updated user |
| Disable 2FA | `POST /auth/2fa/disable` | Authenticated; returns updated user |
| Own profile read/update | `GET/PATCH /users/:id` | Self only; another user's ID produces 403 |

Registration username length is 3–30; password minimum is 8. Email codes are
6-digit strings, not numbers. The login challenge token expires in 10 minutes;
normal JWT signing uses 23 hours. No refresh-token route exists. Logout revocation
is real in this version, unlike the historical handoff description.

Email delivery uses `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. A configured route is
not evidence that delivery works in a new checkout. Password-reset request avoids
account enumeration and may hide delivery failure from the caller; test delivery
in an isolated configured environment rather than assuming 204 proves receipt.

### Profile and avatar contracts worth preserving

`PATCH /users/:id` accepts `username`, `email`, `theme`, `notificationBadge`,
`avatarUrl`, and `avatarImage` (only the supplied fields need be sent).

- `theme`: `system | light | dark`; `notificationBadge`: boolean. Both are actually
  persisted and returned by this repo's service/mapper.
- `avatarUrl`: optional nullable string, at most 500 characters.
- `avatarImage`: JPEG data URL matching the DTO's base64 expression; at most 32791
  characters, decoded bytes at most 24 KiB, with service-level canonical base64
  and JPEG start/end marker checks. This is JSON, not a multipart avatar route.
- Send either `avatarUrl` or `avatarImage`, never both. The returned `avatarUrl`
  contains the stored URL/data URL. Preserve frontend resizing/compression before
  uploading a custom avatar.
- Email changes affect verification status; refresh the returned profile.

## Workspaces, membership and invitations

Source: [WorkspacesController](../../apps/backend/src/modules/workspaces/controllers/workspaces.controller.ts),
[WorkspacesService](../../apps/backend/src/modules/workspaces/services/workspaces.service.ts),
[workspace policy](../../apps/backend/src/modules/workspaces/workspace-policy.ts).

Implemented: workspace create/list/detail/update, reporting time zone, archive and
restore, soft deletion, member list/removal, voluntary leave, ownership transfer,
saved backlog views, Kanban configuration, and invitation lifecycle.

- `POST /workspaces`: `{name,description?}`. `PATCH /workspaces/:id` also accepts
  `reportingTimeZone`; default reporting zone is `Africa/Casablanca`, with IANA
  validation. Use the returned zone for calendar dates and analytics.
- Member-visible lists/details are membership scoped. Owner-only management checks
  apply to workspace changes, member removal, archive/restore/deletion, ownership
  transfer and invitation administration. Projects use writable membership checks
  rather than blanket owner-only access.
- `DELETE /workspaces/:id/membership` leaves; an owner must transfer ownership
  before leaving. `PATCH /workspaces/:id/owner/:userId` transfers to a member.
- `POST /workspaces/:id/invitations` accepts `invitedUserId`, `invitedEmail`, or
  `invitedUsername`; follow service validation rather than sending ambiguous
  identifiers together. Pending invites are available through `GET .../invitations`.
- Accept/reject/cancel use `PATCH .../:invitationId/{accept,reject,cancel}`.
  Resend uses `POST .../:invitationId/resend`.
- Email-link redemption uses `POST .../:invitationId/redeem` with `{token}`.
  The controller checks a 43-character URL-safe token; preserve the existing
  frontend flow that removes the invitation secret from the address bar.
- Invitations can be visible through notification DTOs as well. Do not fabricate
  invitee accounts or call a non-existent user directory endpoint.
- Archive is a read-only mode, not deletion. Workspace-scoped mutating services
  commonly enforce writable checks and return 409 with the archived-workspace
  message (tasks/files/projects/chat and owner-management paths). Notes write
  methods lack that explicit guard in this snapshot; keep frontend archived-mode
  controls and record that server-side gap. Watch preferences and saved views are
  personal settings, not blanket owner-only workspace edits. Render read-only
  states instead of retrying rejected writes indefinitely.

## Task planning and Kanban

Source: [TasksController](../../apps/backend/src/modules/tasks/controllers/tasks.controller.ts),
[TasksService](../../apps/backend/src/modules/tasks/services/tasks.service.ts).

Implemented: task creation/detail/edit/delete, readable `TASK-n` keys, manual rank,
priority, assignment, due dates, descriptions, acceptance criteria, blockers,
dependencies, editable comments, watchers, board grouping and status history.

- Create through `POST /workspaces/:workspaceId/tasks`; initial status is BACKLOG.
  Accepts `title`, `description`, `acceptanceCriteria`, `priority`, `assigneeId`,
  `dueAt`, `dueDate`. `assigneeId` is creation-only; later assignment has its own API.
- `PATCH /tasks/:id` accepts editable text/date/priority fields and `position`.
  It does not accept status, board-column ID, or a project link.
- Status transition: `POST /tasks/:id/transition` with `{toStatus,note?}`. Reorder
  separately with `{position}`. Priority enum: LOW, MEDIUM, HIGH, URGENT.
- `GET /workspaces/:workspaceId/board` returns `workspaceId`, `reportingTimeZone`,
  `activeWipLimit`, `activeCount`, `columns:[{status,tasks}]`, `assigneesByTaskId`.
  Use BACKLOG as planning data and TODO as the first visible board column.
- Assignment is `GET/POST/DELETE /tasks/:id/assignment`, with `{userId}` on POST.
- Comments: list/create plus comment PATCH/DELETE; body `{content}`. Respect
  author-only editing/deletion and archived mode; workspace ownership alone does
  not authorize editing another author's task comment.
- Dependencies: create with `{dependsOnTaskId}`, list, delete by dependency ID;
  retain cycle and workspace-boundary validation from server errors.
- Block with `{reason}` through POST `/tasks/:id/block`; DELETE unblocks.
- Watcher preference: GET/PUT/DELETE `/tasks/:id/watch`; response `{watching}`.
  This drives watched-task comment/status notifications, not arbitrary subscriptions.

### Allowed transitions

| From | Allowed destinations |
|---|---|
| BACKLOG | TODO, CANCELLED |
| TODO | BACKLOG, READY, CANCELLED |
| READY | TODO, IN_PROGRESS, CANCELLED |
| IN_PROGRESS | READY, REVIEW, CANCELLED |
| REVIEW | IN_PROGRESS, DONE, CANCELLED |
| DONE | REVIEW |
| CANCELLED | none |

Active WIP includes IN_PROGRESS and REVIEW. The service enforces the WIP limit
when entering active work from outside it. Blockers/dependencies exist as separate
features; `transition()` does not itself enforce a blocker/dependency gate in this
snapshot, so do not describe such gating as server-enforced. Do not expose arbitrary drag destinations or fake successful
moves after a 400/409. Refetch board/related project progress on success.

`dueDate` is a date-only input; `dueAt` is an instant. Check the current mapper's
serialization before normalizing them: the task response DTO lists `dueAt`, while
calendar helpers and entity logic handle date-only semantics. Do not assume the
response echoes every accepted creation field.

### Board settings and saved views

`GET/PATCH /workspaces/:id/kanban-settings` supports WIP limit, definitions of ready
and done. No editable board-column array is accepted by this DTO; do not send
`boardColumns` or `columns` from a different implementation. `GET/POST
/workspaces/:id/backlog-views` persists named views using `SaveBacklogViewDto`.
These are not `/saved-views` endpoints. Inspect exact nested validation in the DTO
reference before sending filters or column structures.

## Projects and milestones

Source: [ProjectsController](../../apps/backend/src/modules/workspaces/controllers/projects.controller.ts),
[ProjectsService](../../apps/backend/src/modules/workspaces/services/projects.service.ts).

- Project list includes milestones, linked tasks and `progress:{done,total}`.
  Project fields include `id,name,ownerId,targetDate,status`; linked tasks include
  `id,taskNumber,title,status,projectId,milestoneId`.
- POST creates; PUT `/:projectId` updates; DELETE removes. Project DTO requires
  `name` and `status`, with optional `targetDate` and nullable `ownerId`.
  Statuses are lower-case `planned`, `active`, `on-hold`, `completed`.
- Project and milestone save operations return `{id}`; reload the project list for
  its full aggregate. Do not assume create returns a complete project card.
- Milestones have create/update/delete APIs under `/:projectId/milestones`.
- Link task through `PUT /workspaces/:workspaceId/projects/task-links/:taskId` with
  nullable `projectId`/`milestoneId` and optional `onlyUngrouped`.
- Project owners must be workspace members; links must remain within the workspace.
- Project pins and per-card gradient choices have no backend API in this snapshot.
  Keep supported browser-local behavior unless a new contract is added later.

## Files

Source: [FilesController](../../apps/backend/src/modules/files/controllers/files.controller.ts),
[FilesService](../../apps/backend/src/modules/files/services/files.service.ts).

- Upload POST is multipart with field `file`, optional `displayName` and `taskId`;
  maximum file size 10 MiB. Let the browser generate the multipart boundary.
- List GET supports **only `page` and `limit`**, limit 1–100, default 20. It returns
  a plain array ordered by newest creation then ID. Unknown search/sort/kind/
  uploader/lookahead query fields cause 400. Implement those controls locally over
  supported metadata pages; avoid filtering only the first backend page.
- Detail GET, display-name PATCH, authenticated download GET, and DELETE exist.
  Metadata contains `sizeBytes` as a string and nullable uploader/task/MIME fields.
- Rename uses `{displayName}` (1–255, no slashes/control characters). Uploaders
  and workspace owners may rename/delete; other members can read/download.
- Download is a binary `StreamableFile`, not a JSON URL. Use authenticated fetch
  and a Blob/object URL, including for supported previews.
- File categories/icons and list/grid preferences are frontend behavior.

## Notes

Source: [NotesController](../../apps/backend/src/modules/notes/controllers/notes.controller.ts),
[NotesService](../../apps/backend/src/modules/notes/services/notes.service.ts).

- Create/read/list/update/delete and pinning exist. Title is 1–200 characters;
  content is an optional nullable string. PATCH accepts `title`, `content`, `pinned`.
- List supports **only `page` and `limit`**, limit 1–100; no server search, sort,
  lookahead or pinned-only query. A plain array is returned.
- Responses include `id,workspaceId,creatorId,title,content,pinnedAt,createdAt,updatedAt`.
  Editing/deletion require creator or workspace-owner access.
- No revision/history/restore controller route exists. A migration named
  `AddNoteRevisions` is not evidence of a usable revisions API. Do not send
  optimistic revision fields or expose history controls as working features.
- Rich text is a frontend editor concern; preserve the app's sanitization and
  content encoding rather than inventing a backend editor protocol.

## Chat and direct messages

Source: [ChatController](../../apps/backend/src/modules/chat/controllers/chat.controller.ts),
[SocialController](../../apps/backend/src/modules/social/controllers/social.controller.ts).

- Workspace history/send: GET/POST `/workspaces/:workspaceId/messages`;
  unread count GET and per-message read PATCH exist.
- Direct conversations: list, unread count, open by user ID, list/send messages,
  and mark the conversation read. Participants only; cannot open a conversation
  with yourself. No public user-directory/search endpoint was found.
- History/list DTOs accept page/limit only, with limits 1–100. Do not assume cursor,
  text search or date query parameters from another branch.
- Send uses `{content,replyToId?,requestId?}`. Reply IDs are scoped to the
  conversation/workspace; request IDs enable idempotent sending and are UUID v4.
  Reusing a request ID for a different message can cause 409.
- Responses include a reply preview when applicable. Deduplicate REST responses
  and socket deliveries by message ID. See [real-time guide](REALTIME.md).
- No message edit/delete/reaction endpoint is exposed by current controllers.
  Database migration names or unregistered helpers do not constitute those APIs.

## Notifications and activity

- Notifications: list, unread count, mark one/read-all, get/update preferences.
  List accepts `category,page,limit,unreadOnly`; use string `true`/`false` in queries.
- Categories: assignments, comments, status, invitations, messages. Only assignments,
  comments, status are configurable preferences (`{category,enabled}`).
- Activity: array feed `/activities`, paginated envelope `/activities/page`, owner-only
  paginated audit `/activities/audit`, under the workspace path.
  Query: `page,limit,category,actorUserId,from,before`. Categories are tasks/files/
  members/notes/board/github. Preserve resource availability/deep-link behavior.
- Notification types include invitation/friend-request names, but no friendship
  management controller exists. Do not infer friend actions from a type enum.

## Analytics and GitHub

- Task analytics GET `/workspaces/:workspaceId/analytics`: query `days` is 7 or 30,
  optional ISO `day` and `asOf`. Future timestamps and flow days outside the window
  are rejected. Response includes `timeZone,asOf,flowDay,rows,completions,durations,flowTasks`.
  History drives charts; do not fabricate historic observations to fill a chart.
- GitHub OAuth begins with authenticated GET `/github/connect?workspaceId=...`,
  returning `{authorizationUrl}`. Native GET `/github/callback` completes code/state.
  With frontend URL configured it returns 303 to the workspace GitHub page with
  `#github-setup=<setupSessionId>`; otherwise it returns the setup result.
- Available repositories are POST `/github/available-repositories` using workspace
  and setup session identifiers. Connecting a repository is workspace POST
  `/github/repository` with `{setupSessionId,githubRepositoryId}`.
- Workspace owner checks apply to OAuth setup, available repositories, connection,
  disconnection and collaborator list. Membership checks apply to repository reads,
  contributors, branches, statistics/commits; sync also requires writable access.
- Repository GET returns **204 when not connected**. Render a connect state.
- Sync POST returns `GitHubSyncResult`; list commits is paginated with raw page/limit
  query values validated by the service. Branches, contributors and collaborators
  use distinct endpoints and distinct response types defined in GitHubApiService.
- Daily commit statistics are **7 days, UTC** in this source; consume `days` and
  `timezone` from the response rather than hard-coding 30 days.
- OAuth/client/callback/token-encryption configuration and GitHub permissions must
  be valid. This source audit did not authorize a GitHub account or sync anything.
- Do not infer tree/blob/task-repository-link editing APIs from entity names:
  the current controller catalog is the supported integration surface.

## Explicit gaps and frontend-only capabilities

No refresh-token endpoint, global user directory, friendship management, note
revision/history, message reactions/edit/delete, project-pin persistence or
server-side file/note search/filter/sort API is exposed at this snapshot.
Some features have tables or notification enum values without controller routes.
Treat those as schema groundwork, not shipped frontend contracts.

The backend can support the designed UI without copying another backend. Preserve
its complete current behavior first, then adapt the frontend against this catalog.
