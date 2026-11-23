# Migration baseline and differences

## Repository boundaries

Correct repository: `git@github.com:mrfoxGN/transcendence.git`.
New checkout: `/home/ntaha/transcendence-mrfoxgn` (sibling of the original folder).
Audited base: `main` / `d40145400edeaef018e6bad24c2e9851ebbe35a3`.
Documentation branch: `codex/backend-api-inventory`.

Design implementation source remains `/home/ntaha/ft_transcendence_final`, remote
`ELMO-KH/ft_transcendence`, branch `feature/frontend`. Its source HEAD during the
comparison was `952d0f784be0c5047368aeed07a7147ff53a6a28`. Nothing was moved out of it.

No frontend migration has happened in this new checkout. The existing frontend,
backend, migrations, Docker configuration and environment files are preserved.
No database volume, account, token or demo workspace data was copied.

## Backend comparison against the previous local repository

A byte comparison of non-test TypeScript files under `apps/backend/src` found
only these five different source files; no additional or missing non-test `.ts`
source files were found in that comparison:

| File | Difference / migration impact |
|---|---|
| `database/data-source.ts` | New repo reads migration configuration from environment directly; preserve its setup rather than copying the old data source |
| `modules/users/dto/update-profile.dto.ts` | Adds validated `avatarImage` JPEG data URL input alongside URL-based avatar updates |
| `modules/users/entities/user.entity.ts` | Avatar storage accepts larger data plus preference persistence fields; preserve the target entity |
| `modules/users/mappers/user.mapper.ts` | Returns persisted `theme` and `notificationBadge` |
| `modules/users/services/users.service.ts` | Accepts preference-only patches and persists them; validates JPEG avatar bytes/canonical base64/24 KiB and excludes simultaneous URL + image |

This comparison is source-level, not proof that deployed databases or service
configuration match. Tests, dependency manifests, deployment files and historical
branch behavior were not declared identical by that five-file statement.
The target's existing avatar upload and persisted preference behavior must not be
lost when transferring the redesigned account/settings pages.

## Remote branch snapshot

Counts are `git rev-list --left-right --count main...<branch>` as cloned on
2026-11-23. Main-only means commits not in that branch; branch-only means commits
not in main. Different content on an older branch does not mean it has new features.

| Remote branch | Head | Main-only commits | Branch-only commits |
|---|---|---|---|
| `origin/anass/activities` | `1d1e7d2` | 93 | 0 |
| `origin/anass/backend-integration` | `1d25875` | 96 | 0 |
| `origin/anass/direct-message-notifications` | `7ceeaa1` | 105 | 0 |
| `origin/anass/files` | `1aa241a` | 106 | 0 |
| `origin/anass/github-integration` | `11976fa` | 89 | 0 |
| `origin/anass/invitation-accepted-notifications` | `cb8ac96` | 105 | 0 |
| `origin/anass/notifications` | `3aabca2` | 106 | 0 |
| `origin/anass/workspace-chat` | `a35572b` | 106 | 0 |
| `origin/anass/workspace-invitation-notifications` | `c3d46b5` | 105 | 0 |
| `origin/feature/github-refresh-sync` | `eda9921` | 86 | 0 |
| `origin/feature/github-workspace-improvements` | `e86271c` | 25 | 0 |
| `origin/frontend` | `3f4934d` | 35 | 0 |
| `origin/khaled` | `ee763f9` | 68 | 3 |
| `origin/khaled_v2` | `ae08201` | 29 | 0 |
| `origin/main` | `d401454` | 0 | 0 |
| `origin/mbenjbar` | `e6b369e` | 68 | 9 |
| `origin/mbenjbar---V2` | `d401454` | 0 | 0 |
| `origin/revert-3-frontend` | `a3925c6` | 68 | 1 |

`origin/frontend` is **35 commits behind main with zero branch-only commits** at
this snapshot. It should not be used as the migration base solely for its name.
The GitHub feature branches shown above also have zero branch-only commits; main
already contains their ancestry. `khaled`, `mbenjbar`, and `revert-3-frontend` have
branch-only commits; their alternate contracts have not been certified by this
main audit. Audit them separately if the team chooses one as the integration base.

## Integration priorities

| Area | Preserve/adapt during frontend migration |
|---|---|
| Auth | Current email-code verification/recovery and 2FA challenge flow; do not replace it with obsolete link-only recovery |
| Profile/avatar | Keep target upload/compression flow and `avatarImage` contract; preserve preference persistence and returned theme/badge fields |
| Files | Carry over the supported page/limit loader and frontend filtering fix from `952d0f7`; reject unknown query fields in fixtures |
| Notes | Keep supported page/limit requests and local search/sort; the current frontend fetches only the first 100 notes for client-side filtering, so extend collection loading if search must cover larger workspaces |
| Notes history | Keep history/revision UI absent unless an actual new API is introduced; migrations alone are insufficient |
| Tasks | Preserve TODO vs BACKLOG, adjacent status transitions, `{toStatus}` request and separate `{position}` reorder |
| Settings | Preserve owner checks, archive/read-only, reporting time zone, real 2FA and supported Kanban fields; do not add editable column arrays without an API |
| Projects | POST/PUT returns `{id}`; reload aggregates; keep task/milestone links, progress and browser-local pins |
| GitHub | Preserve OAuth setup sessions, callback fragment cleanup, 204 disconnected state, refresh/sync, statistics, contributors/collaborators and branch APIs |
| Chat/DM | Preserve REST plus Socket.IO, replies, requestId deduplication, unread/read state; no invented message editing or reaction routes |
| Activity/notifications | Keep category filters, audit permissions, deep links and actual notification preference categories |
| Assets | Bring theme-aware illustrations and blue/pink/violet identity as frontend assets only |
| Testing | Update mocks to enforce real DTO/query rules; relaxed fixtures previously hid the Files mismatch |

The Notes search/sort coverage caveat was verified in the existing `NotesPage.tsx`:
normal browsing is paginated, while client-side filtering requests page 1 with
limit 100. Its requests already comply with `ListNotesDto`; it should not be
reported as the same unsupported-query bug as Files.

## Proposed migration sequence

1. Branch from audited current main (or the documentation branch based on it).
2. Keep target backend/deployment files; compare the two frontends by feature.
3. Move shared tokens, styles, layout and assets, then adapt native account flows.
4. Migrate workspace shell and functional pages in coherent frontend-only commits.
5. Wire all currently supported features; preserve the target's avatar/preferences
   work, retain the Files query fix, and check Notes search coverage locally.
6. Test actual contract shapes: 204/no body, strict query rejection, current account
   fields, multipart uploads, archive/permission failures and socket reconnection.
7. Run target frontend build and isolated UI checks. With approved isolated runtime
   configuration, run existing backend tests and representative API smoke checks.
8. Review a frontend-only diff against the target base before pushing. Push only
   when requested; do not force-update a shared branch to replace its history.

## Runtime boundaries for later work

Do not start another Compose stack with the old stack's ports without checking
for collisions (typically 443/8080/3306). Keep database volumes/project names
isolated. Do not copy `.env`, run migrations against the existing database, invoke
machine-wide cleanup targets, or transplant demo data as part of a Git migration.
The clone currently has no installed dependencies or configured runtime from this
audit. It is documentation-ready, not claimed to be running or deployment-tested.

## Source-level limitations to account for

- Blockers/dependencies are recorded, but `TasksService.transition()` does not
  enforce them as a transition gate; only the documented transition/WIP behavior
  should be claimed as server-enforced.
- Notes write methods do not explicitly apply `assertWorkspaceWritable`, unlike
  tasks/files/projects/workspace chat. Preserve frontend archived-mode controls;
  discuss server enforcement with the backend team if required rather than
  silently changing the backend during the frontend migration.
- Kanban settings do not accept editable column arrays; respect the actual DTO.
- The source inventory is exhaustive for controller HTTP decorators, but it is not
  a deployed-service probe, OpenAPI conformance test, or database audit.
