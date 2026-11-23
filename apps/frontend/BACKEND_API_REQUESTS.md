# Backend API requests — DevUP frontend handoff

Prepared: 2026-11-23. Repository: `mrfoxGN/transcendence`, branch `frontend`.
Baseline audited: main `d401454`; frontend migration commits `d3f06e5`, `d8d75bc`,
`2479427`. Backend source was not changed during migration.

Audience: backend team and frontend integration owner.
Status: **proposal for agreement**, not an implemented API specification.

## Request to the backend team

The approved frontend has been migrated and works with the current APIs. Please
review the requests below, agree on priorities/contracts, and return endpoint,
DTO, permission and event details before frontend integration begins.

The items below are not all release blockers. Core tasks, projects, notes, files,
chat, authentication, notifications and GitHub screens already work. Some requests
extend existing behavior; others add capabilities that do not currently exist.
Do not remove working frontend fallbacks while these APIs are being developed.

Existing source evidence:

- [Current API catalog](../../docs/backend-audit/HTTP_API.md)
- [Current DTOs and validation](../../docs/backend-audit/DTO_REFERENCE.md)
- [Current Socket.IO contract](../../docs/backend-audit/REALTIME.md)
- [Migration limitations](API_LIMITATIONS.md)
- [Migration verification](UI_MIGRATION.md)

**All new routes, fields and events below are proposed.** Do not call them from the
frontend until the backend team implements and documents them. Route examples use
native Nest paths; the deployed frontend prepends `/api` through the existing proxy.

## Priorities and ownership

Priority meanings: P0 = existing consistency issue to review first; P1 = recommended
next feature/integration work; P2 = optional enhancement requiring product agreement.
These are suggested priorities, not a claim that the current application is unusable.

| ID | Priority | Request | Current frontend behavior |
|---|---|---|---|
| BE-01 | P0 | Enforce archived-workspace policy for Notes writes | UI disables writes; service lacks the explicit guard used elsewhere |
| BE-02 | P1 | Decide/enforce blocker and dependency transition policy | Blockers/dependencies are displayed; backend transition does not enforce them as gates |
| BE-03 | P1 | Server-side Files/Notes search, filtering and sorting | Works locally after loading supported metadata pages |
| BE-04 | P1 | Notes revisions, conflict detection and restore | Rich editor/autosave works; no history or restore capability |
| BE-05 | P1 | Message editing and deletion | Sending, reading and replies work |
| BE-06 | P1 | Per-user project pins and workspace display preferences | Pins and file view mode are browser-local |
| BE-07 | P2 | Message reactions | No working reaction controls exposed |
| BE-08 | P2 | Typing and scoped presence | Message events work; typing/presence is unavailable |
| BE-09 | P2 | Custom board columns | Fixed workflow columns and supported transitions work |
| BE-10 | P2 | User discovery and friend management | Workspace members/invitations/direct conversations work |
| BE-11 | P2 | GitHub links on tasks | Repository data works; task-to-code link management is unavailable |
| BE-12 | P2 | Refreshable authenticated sessions | Expired/revoked sessions require sign-in |
| CFG-01 | Verification | Email verification/recovery/2FA delivery | APIs exist; need configured delivery and live checks |
| CFG-02 | Verification | GitHub OAuth, permissions and sync | APIs exist; need external account/configuration and live checks |
| QA-01 | Verification | Multi-user chat delivery/read synchronization | Authenticated socket join and read APIs tested; multi-user delivery needs testing |

Backend owns persistence, validation, authorization, transactions, events and tests.
Frontend owns controls, loading/error/empty states and integration after contracts
are available. Please identify an owner and target release for each accepted item.

## Shared contract requirements

- Keep current APIs compatible. The global validation pipe rejects unknown fields;
  update DTO validation before asking the frontend to send new fields/query keys.
- Use UUID resource IDs, ISO timestamps, and existing enum/date conventions.
- Retain `Authorization: Bearer` for protected APIs unless explicitly changing the
  authentication contract. Check current membership/ownership, not only valid JWT.
- Define archived-workspace behavior for every mutation. Personal display settings
  may have different rules from shared workspace content; document the distinction.
- Use consistent existing error statuses: 400 invalid input, 401 session expiry,
  403/404 access/unavailable resource according to current disclosure policy,
  409 state/version conflicts. Keep a readable `message`; an additive stable `code`
  is recommended so the UI does not have to parse English error strings.
- Define response shape, pagination, empty state and 204 behavior explicitly.
- For lists, use stable ordering/tie-breakers and a documented maximum page size.
- For retries, prefer idempotent writes and deduplicate events by resource/version.
- Publish source-linked examples or a usable OpenAPI schema for success and errors.
  Do not introduce destructive schema changes just to match a visual design.

## BE-01 — Archived Notes consistency

**Existing source:** `apps/backend/src/modules/notes/services/notes.service.ts` and
`modules/workspaces/workspace-policy.ts`. Notes write methods lack the explicit
writable guard present in Files/tasks/projects/workspace chat.

Request:

- Apply the established archived-workspace policy to note create/update/delete,
  pinning and any future restore endpoint.
- Preserve readable access for authorized members of archived workspaces.
- Prefer the existing 409 archived-workspace response used by other modules.

Acceptance:

- An archived workspace rejects writes even if called directly outside the UI.
- Read/list works for members; outsiders are denied; restoring the workspace
  permits authorized writes again.
- Creator/owner edit/delete permissions remain intact.

No new frontend endpoint is needed for this fix.

## BE-02 — Blocker/dependency transition policy

**Existing source:** `modules/tasks/services/tasks.service.ts`, especially
`transition()` and the dependency/block APIs.

Decision required: should blocked tasks or unfinished dependencies prevent entry
into active work, completion, both, or neither? The current service records these
relationships but does not use them as transition gates. Do not assume the UI's
labels imply backend enforcement.

If enforcement is approved:

- Extend the existing `POST /tasks/:id/transition`, keeping `{toStatus,note?}`.
- Check policy and WIP constraints in the same transaction as the transition.
- Return a readable 409 and stable code, for example `TASK_BLOCKED` or
  `DEPENDENCIES_INCOMPLETE`, with authorized dependency IDs where useful.
- Specify behavior for cancelled/deleted dependencies and any override permission.

Acceptance: direct API calls cannot bypass the agreed policy; allowed transitions
still work; concurrent requests cannot bypass WIP or dependency checks.

## BE-03 — Server-side document queries

**Existing source:** `modules/files/dto/list-workspace-files.dto.ts` and
`modules/notes/dto/list-notes.dto.ts`. Current list APIs accept only `page`/`limit`
and return plain arrays. The frontend now searches all collected metadata locally,
including records beyond the first 100, but this is less efficient at scale.

Suggested additive routes (or an agreed versioned equivalent):

```http
GET /workspaces/:workspaceId/files/search?q=&kind=&uploaderId=&sort=recent&page=1&limit=20
GET /workspaces/:workspaceId/notes/search?q=&pinned=&sort=updated&page=1&limit=20
```

Suggested query vocabulary:

| Query | Proposed values / behavior |
|---|---|
| `q` | Trimmed search, maximum 200 characters; filename for files; title/content for notes |
| `kind` | `image`, `document`, `text`, `other`; agree exact MIME/extension mapping with frontend |
| `uploaderId` | Workspace user UUID; define treatment of removed/deleted uploaders |
| `pinned` | Notes only, boolean; omission means both pinned and unpinned |
| Files `sort` | `recent`, `name`, `size`; define direction for each |
| Notes `sort` | `updated`, `name`; define whether pinned notes always come first |
| `page`, `limit` | Positive integers; proposed maximum limit 100 |

Suggested response:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "hasNext": false
}
```

Do not silently replace existing array responses with envelopes: preserve legacy
routes or agree a versioned migration. Declare static `search` routes before
UUID `:fileId`/`:noteId` routes if using those names in Nest.

Acceptance: matches beyond page 1 are found, filters combine correctly, results
are stably ordered, counts match filters, archive reads work, and outsiders cannot
learn filenames/content or uploader details.

Frontend follow-up: replace metadata collection with server queries while keeping
Recent files independent of the selected category/search, as it is now.

## BE-04 — Notes history, concurrency and restore

**Existing source:** Notes controller/DTOs expose no revision/history/restore API.
A migration named `AddNoteRevisions` is not an API contract.

Suggested routes:

```http
GET  /workspaces/:workspaceId/notes/:noteId/revisions?page=1&limit=20
GET  /workspaces/:workspaceId/notes/:noteId/revisions/:revisionId
POST /workspaces/:workspaceId/notes/:noteId/restore
```

Suggested revision summary:

```json
{
  "id": "revision-uuid",
  "noteId": "note-uuid",
  "revision": 7,
  "title": "Checkout decisions",
  "authorId": "user-uuid",
  "createdAt": "2026-11-23T12:00:00Z"
}
```

Revision detail additionally includes `content`. Suggested restore body:

```json
{"revisionId":"revision-uuid","expectedRevision":7}
```

Request an additive `revision` in note responses and optional `expectedRevision`
in the existing note PATCH DTO. When provided, an outdated revision must return
409 without overwriting content. Agree compatibility behavior for older clients
that do not yet send it.

Acceptance:

- History is immutable. Restore creates a new current revision; it does not delete
  or rewrite intervening history.
- Existing note creator/owner mutation permissions and membership read permissions
  apply; archived workspace cannot be restored/edited.
- Concurrent edits and restore conflicts produce recoverable 409 responses.
- Agree autosave coalescing, retention and whether pin-only changes create versions.
  Do not create unlimited full-content snapshots on every keystroke.

Frontend follow-up: history drawer, revision preview/diff, restore confirmation,
unsaved-draft protection and conflict recovery.

## BE-05 and BE-07 — Message editing, deletion and reactions

**Existing source:** Workspace chat and direct-message controllers expose send,
history and read state; existing replies and UUID `requestId` sends must remain.

Suggested editing/deletion routes:

```http
PATCH  /workspaces/:workspaceId/messages/:messageId
DELETE /workspaces/:workspaceId/messages/:messageId
PATCH  /direct-conversations/:conversationId/messages/:messageId
DELETE /direct-conversations/:conversationId/messages/:messageId
```

PATCH body: `{content,expectedVersion?}`. Add documented `editedAt`, `deletedAt`
and optionally `version` response fields. Prefer soft-delete tombstones so message
order and reply references remain stable. For backward compatibility with today's
string `content`, agree an empty string plus `deletedAt` or explicitly version any
nullable-content change.

Suggested reaction routes, mirrored under both message paths:

```http
PUT    .../:messageId/reactions/:reaction
DELETE .../:messageId/reactions/:reaction
```

Use a small allowlist/validated reaction identifier, not arbitrary unbounded text.
Response should include reaction counts and whether the current user reacted.
PUT/DELETE should be idempotent per user/message/reaction.

Proposed server events (not current events):

- `workspace-message.updated`, `workspace-message.deleted`,
  `workspace-message.reactions-changed`.
- `direct-message.updated`, `direct-message.deleted`,
  `direct-message.reactions-changed`.

Acceptance:

- Define author-only edit/delete and any moderation exceptions explicitly.
- Members/participants only; IDs from other workspaces/conversations are rejected.
- Deleted reply targets render unavailable previews without exposing old content.
- Duplicate/reordered events converge using message ID/version.
- Preserve unread/read cursors, pagination order, retry deduplication and archive
  policy; edits must not re-send a message as a new unread message.

Frontend follow-up: message action menu, edited/deleted presentation, reactions,
and matching socket updates, without optimistic fake success.

## BE-06 — Persistent per-user UI preferences

Current pins and file layout are browser-local. Automatic card colors are derived
from stable IDs, so they do not require an API unless users can customize them.

Suggested additive workspace preference API:

```http
GET   /workspaces/:workspaceId/me/preferences
PATCH /workspaces/:workspaceId/me/preferences
PUT   /workspaces/:workspaceId/me/pinned-projects/:projectId
DELETE /workspaces/:workspaceId/me/pinned-projects/:projectId
```

Suggested preference response:

```json
{"filesView":"grid","pinnedProjectIds":["project-uuid"],"version":1}
```

- Pins belong to the requesting user/membership, not a global workspace setting.
- Verify every pinned project belongs to this workspace; remove stale pins safely.
- Define cross-device ordering and merge behavior. Pin/unpin should be idempotent.
- Palette customization is optional: agree shared vs personal ownership first;
  store validated palette IDs from approved blue/pink/violet combinations, not
  arbitrary CSS. Default derived gradients must continue working.

Acceptance: choices survive sign-out/new browser login, other members' preferences
are isolated, membership removal removes access, and absent preferences return
usable defaults. Do not overwrite the existing global profile `theme` and
`notificationBadge` API with these workspace-specific preferences.

## BE-08 — Typing and presence

Current gateways have no typing/presence contract. Use authenticated Socket.IO;
this is not an HTTP polling feature by default.

Proposed client events:

- `workspace-chat.typing` with `{workspaceId,isTyping}`.
- `direct-chat.typing` with `{conversationId,isTyping}`.

Proposed server events of the same names add server-derived `userId` and an
`expiresAt`. Presence can use `workspace-presence.snapshot` and
`workspace-presence.changed` with a scoped user/state payload, after agreement.

Acceptance:

- Recheck membership/participation; never trust a client-supplied sender user ID.
- Rate-limit and expire typing within a short TTL even without a stop event.
- Define multiple-tab/device semantics; one closed tab must not mark an otherwise
  connected user offline. Remove subscriptions on membership loss/logout.
- Share presence only with authorized users. Agree privacy policy before exposing
  global availability or persistent last-seen timestamps.

## BE-09 — Custom board columns: design decision first

The current API uses fixed TaskStatus values and adjacent allowed transitions.
Do not implement a generic column array that bypasses workflow/WIP rules.

Please choose one model:

1. Custom labels/order for existing status columns only; or
2. Multiple custom columns mapped to fixed workflow status categories.

The second model needs explicit column identity on tasks and rules for default
columns, migration of existing tasks, active WIP aggregation and transition policy.

Possible management surface after agreement:

```http
GET/POST      /workspaces/:workspaceId/board-columns
PATCH/DELETE  /workspaces/:workspaceId/board-columns/:columnId
PUT           /workspaces/:workspaceId/board-columns/order
```

Acceptance: owner-only management; atomic reorder with conflict detection; reject
deletion of a populated column unless tasks are explicitly reassigned; reject
cross-workspace IDs; keep old status-based transitions compatible; enforce archive
and WIP rules server-side. Existing Kanban DTOs must not accept undocumented fields.

Frontend work starts after the model and transition response are agreed.

## BE-10 — User discovery and friendships

No global directory/search or friendship management controller exists today.
Workspace invitations already support ID/email/username identifiers; keep them.

Proposed discovery: `GET /users/search?q=...&page=1&limit=20`, subject to an agreed
visibility scope (for example shared-workspace users, not an unrestricted directory).
Return minimal public profile fields: `id`, `username`, `avatarUrl`. Do not return
email addresses or account-security fields by default. Define minimum query length,
rate limits and whether users may opt out.

If friendship is in scope, proposed routes:

```http
GET  /friendships?status=pending&page=1&limit=20
POST /friend-requests                         body: {userId}
POST /friend-requests/:id/accept
POST /friend-requests/:id/reject
DELETE /friend-requests/:id
DELETE /friendships/:id
```

Acceptance: only intended recipients accept/reject, only senders cancel pending
requests, users cannot target themselves or duplicate reciprocal requests, and
only involved users can list/manage their relationships. Reuse existing
notification infrastructure without implying that enum values alone implement
this flow. Friendship must not silently change workspace or DM permissions.

## BE-11 — GitHub links attached to tasks

Current GitHub connection, branch/commit reads, contributors/collaborators and sync
APIs exist. This request is for the missing task-link management only.

Suggested routes:

```http
GET/POST /tasks/:taskId/repository-links
DELETE   /tasks/:taskId/repository-links/:linkId
```

Suggested body:

```json
{"repositoryId":"repository-uuid","type":"COMMIT","sha":"full-commit-sha"}
```

Agree variants for `REPOSITORY`, `BRANCH`, `FILE`, `COMMIT`: branch/ref, file path,
commit SHA and response display URL. These names follow existing enum groundwork,
not a currently accepted request DTO.

Acceptance: authorized task member access, repository belongs to task workspace,
validated reference/path, duplicate-link handling, archived-write rejection, and
clear unavailable states after disconnect/deletion. Never expose OAuth credentials
or accept arbitrary external URLs as trusted repository metadata.

## BE-12 — Refreshable sessions

Current JWTs expire; no refresh endpoint exists. This is optional UX work, not a
requirement to weaken current token-version revocation or expiry.

Proposed: `POST /auth/refresh`. Please agree the complete session model before
frontend work. Prefer rotating refresh credentials in HttpOnly/Secure cookies,
with appropriate SameSite/CSRF behavior for the actual deployment origin.

Acceptance:

- Establish a refresh session only after successful password/2FA completion.
- Enforce expiry, rotation/replay handling and revocation on logout/password reset,
  password change or disabled account according to agreed policy.
- Keep refresh credentials out of URLs, JavaScript-readable storage and logs.
- Define whether logout is current-session or all-session; preserve current
  tokenVersion behavior unless an explicit compatible replacement is agreed.
- Return 401 when renewal is unavailable; frontend falls back to sign-in and must
  avoid retry loops or multiple simultaneous refresh attempts.

## Existing APIs: configuration and verification, not new endpoint requests

### CFG-01 — Email and 2FA

Configure/test `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and the approved sender/domain
in the target environment without committing secrets. Existing email verification,
password recovery and email 2FA APIs are retained. Please verify delivery,
expiry, resend cooldowns, invalid-code handling, recovery behavior and profile state.
The isolated migration stack intentionally did not copy credentials or send emails.

### CFG-02 — GitHub

Configure the existing OAuth client, exact callback URL, frontend return origin,
token encryption and required repository permissions. Verify connect/callback,
setup session expiry, repo selection, disconnect, sync and role restrictions.
Do not request duplicate OAuth APIs; they are already present.

### QA-01 — Collaboration

Run a two-account test for workspace/DM message delivery, reply previews,
idempotent retries, unread/read updates across tabs, reconnect and membership
removal. Real authenticated socket join and read APIs already passed migration
checks; this additional test does not require sending messages to real users.

## What to return to the frontend team

For each accepted item, please provide:

1. Assigned owner, priority and target branch/commit.
2. Final routes/events and DTOs, including optional/null fields and exact enums.
3. Authentication, membership/ownership and archive behavior.
4. Success, empty and error examples; pagination and conflict/retry semantics.
5. Schema migrations, compatibility/rollout plan and focused automated tests.
6. A configured test environment with synthetic data/accounts, shared through an
   appropriate secret channel where needed—not credentials committed to Git.

Recommended delivery: BE-01 and BE-02 policy review first; then document queries,
Notes history, message actions and per-user preferences; optional collaboration,
board/social/GitHub-link/session enhancements after product agreement.

Frontend integration will be committed separately after the agreed backend
contracts are available. No backend implementation was modified for this handoff.
