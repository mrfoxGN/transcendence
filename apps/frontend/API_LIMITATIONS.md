# Features not supplied by the current backend APIs

Target: `mrfoxGN/transcendence` main `d401454`, backend source unchanged by migration.
Backend-team request: [proposed contracts and acceptance criteria](BACKEND_API_REQUESTS.md).
See [backend audit](../../docs/backend-audit/README.md) for controller/DTO evidence.
This report distinguishes missing server support from working frontend fallbacks.

## Not implemented as working server-backed features

| Capability | Why unavailable / current behavior |
|---|---|
| Notes revision history, compare versions and restore | No revisions/history/restore controller routes or revision DTO contract. Rich editing, autosave, pinning and normal CRUD work; no fake history UI was added. |
| Message editing, deletion and reactions | Workspace and direct-message controllers expose send/list/read, not edit/delete/reaction operations. Existing replies and idempotent sends remain supported. |
| Live typing indicators and presence | No corresponding gateway events. Real message delivery/read/unread events remain connected. |
| Custom board-column creation/removal/reordering | Current board uses fixed TaskStatus values; Kanban settings accepts WIP and definitions, not arbitrary column arrays. Supported task drag/reorder/status transitions remain. |
| Friend requests / global user directory search | Friendship entities/notification names exist, but no management/search controller routes. Existing workspace members, invitations and direct conversations remain. |
| GitHub task-to-branch/file/commit link management | Related entities alone do not expose CRUD routes. Repository connection, commits, branches, contributors, collaborators and sync retain their supported APIs. |
| Silent JWT session refresh | No refresh-token endpoint. Expired/revoked sessions return to sign-in; real logout/token revocation remains intact. |

These are API limitations, not failed attempts to migrate supported pages. No
placeholder success messages, guessed routes or backend changes were used to
pretend they exist.

## Working frontend behavior without server persistence or processing

| Capability | What works now | Backend support not available |
|---|---|---|
| Project pins | Pin/unpin and Home pinned-project cards, stored in the browser | Cross-device/server-saved pin preferences |
| Project/note gradient identity | Stable blue/pink/violet appearance derived in the frontend | Persisted user-custom palette settings |
| Files and Notes search/filter/sort | Collect supported metadata pages, then filter/sort/paginate locally; search is not limited to the first 100 | Server-side indexed queries for these controls |
| File-type icons and grid/list selection | Type-aware icons, colors, previews and browser-local layout preference | Server-saved display preference |

Loading all metadata makes the current controls correct for the supported API,
but very large workspaces would benefit from a server-side search/paging contract.
No API query keys beyond `page` and `limit` are sent for file/note listing.

## Implemented APIs that need external configuration for a full live check

These are **supported**, not missing:

- Email verification, password recovery and email 2FA: flows retained and DTO/UI
  fixture checks pass; live email delivery was not exercised because Resend
  credentials were not copied/configured in the isolated verification stack.
- GitHub OAuth/repository access/sync: UI and contract fixture checks pass; live
  disconnected state works. No external GitHub account was authorized for this
  migration, so account-dependent reads and sync were not live-tested.
- Multi-user chat delivery: Socket.IO authentication/join and chat read APIs were
  live-tested; no messages were sent to other users during verification.

## Existing backend behavior recorded for the team

- Tasks expose blockers and dependencies, but `transition()` does not enforce them
  as a server-side transition gate in this snapshot. The migration preserves the
  documented workflow/WIP checks and does not claim stronger server enforcement.
- Notes write methods lack the explicit archived-workspace guard used by other
  modules. The frontend preserves read-only controls for archived workspaces;
  server enforcement, if required, is work for the backend team.
- These observations are documented rather than silently patched in the backend.
