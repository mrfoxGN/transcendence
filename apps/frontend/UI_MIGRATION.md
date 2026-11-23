# Frontend migration into mrfoxGN/transcendence

Target branch: `frontend`, based on main `d401454` plus audit `7272a03`.
Approved design source: `ELMO-KH/ft_transcendence` frontend commit `952d0f7`.

## Scope

The approved workspace and entry-page design, light/dark themes, charts, folder and
note cards, rich-text editor, file controls, and theme-aware illustrations were
transferred under `apps/frontend`. The target's custom avatar upload/compression
was retained and combined with the approved onboarding preview.

The target Dockerfile, Nginx config, TLS entrypoint, Vite proxy, backend, migrations,
Compose file and environment example were retained. No `.env` or user/database
content was copied from the previous repository. Verification scripts default to
port 5182 and accept `DEVUP_APP_URL` for another frontend instance.

## Initial verification

- Production frontend build passed (existing chunk-size warning remains).
- Workspace fixture checks passed: 36 desktop/mobile/theme page views plus Notes,
  task workflow, file upload/filter/grid/recent, and GitHub interaction checks.
- Entry fixture checks passed: 32 light/dark desktop/mobile views, short screens,
  workspace selector, 2FA transition, avatar choice and recovery transition.

The fixture checks are not a substitute for target-backend verification. The
isolated `devup-mrfoxgn-migration` Compose stack uses ports 3337/8087/8447 and its
own volumes. Runtime API checks and the unsupported-feature report were completed in
subsequent migration commits, as recorded below.


## API compatibility and final scope

Files and Notes now share page/limit-only metadata loading. Notes search/sort is
no longer restricted to the first 100 notes. The target's JPEG avatar upload,
128px crop/compression, server validation and persisted profile preferences remain.
The original avatar URL option and onboarding preview remain as well.

Backend/API source and deployment configuration are unchanged from target main.
All migration implementation commits modify `apps/frontend` only. Audit documents
were already merged before migration; no files from the old backend were copied.

[API limitations and frontend fallbacks](API_LIMITATIONS.md) is the requested list
of features not completed because the current APIs do not expose them. External
email/GitHub configuration gaps are listed separately from unsupported APIs.

## Real target-backend verification

The isolated stack is `devup-mrfoxgn-migration`, accessible at
`https://localhost:8447`; HTTP port 8087 redirects to HTTPS, MySQL is bound at
localhost:3337, and volumes are scoped to that Compose project. The existing
checkout and any previous stack/data were not reused.

`node scripts/verify-live-target.mjs` is restricted to that isolated local origin.
It creates unique synthetic accounts/workspaces, does not print credentials,
never modifies existing user records and does not send emails/chat messages or
perform external GitHub authorization.

Live checks passed for:

- Register/login/profile and persisted theme/notification preference updates.
- Task creation, assignment, supported transitions, blockers, watches, projects,
  milestone links and computed progress.
- Note create/read/pin and strict rejection of unsupported query parameters.
- Authenticated multipart upload, metadata listing, rename and binary download.
- Analytics, activity, notification preferences, chat read APIs, and GitHub's
  disconnected 204 state.
- Archived-workspace mutation rejection and restore.
- Real authenticated Socket.IO readiness and workspace join.
- Custom avatar selection, browser JPEG compression, and save through the real API.
- All 12 workspace pages without JavaScript errors.

Email delivery/2FA email confirmation, external GitHub authorization/sync, and
multi-user message delivery were not live exercised; see the limitations report.
Their existing supported integrations were retained, not replaced by mocks.

## Re-running checks

From `apps/frontend`, with a compatible installed Playwright browser:

```sh
npm run build
npm run verify:migration
TARGET_ONLY=1 npm run verify:migration
FILES_ONLY=1 npm run verify:migration
SETTINGS_ONLY=1 npm run verify:migration
DARK_ONLY=1 npm run verify:migration
node scripts/verify-entry-pages.mjs
node scripts/verify-empty-illustrations.mjs
node scripts/verify-live-target.mjs
```

Fixture checks use Vite at port 5182 by default (`DEVUP_APP_URL` can override it).
The live check uses the isolated HTTPS stack at port 8447. Fixture tests exercise
UI/API contracts without importing fixtures into production source.
The production build still reports the pre-existing large-bundle warning.


## Final verification results

- Final production build: passed; existing bundle-size warning remains.
- Workspace fixture suite: 36 page/theme/mobile views and interaction checks passed.
- Settings suite: 27 section/theme/mobile views and saves/deep links passed.
- Dark suite: 24 page views plus 18 Settings views; contrast, charts, keyboard,
  disabled/selected/loading states and unchanged light tokens passed.
- Entry suite: 32 light/dark desktop/mobile views plus short-screen and interaction
  checks passed before the document-only compatibility changes.
- Illustrations: all 32 assets loaded; 16 kinds switched correctly in both themes
  at desktop and mobile widths.
- Target suite: 105-note search, strict pagination, JPEG compression/upload,
  theme persistence and enable/disable 2FA contract checks passed.
- Final rebuilt HTTPS frontend against real target backend: all live checks in
  `verify-live-target.mjs` passed, including 12 workspace pages and custom avatar save.
- Scope: every implementation change from audit base `7272a03` is under
  `apps/frontend`; the backend Git tree equals target main `d401454`. Deployment,
  proxy and environment files are unchanged. The old repository remains clean.

No migration commits have been pushed. Test accounts/records exist only in the
isolated stack; the previous demo workspace/database was not migrated.
