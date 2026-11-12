# Frontend handoff and API readiness

Audit date: 2026-11-02. This repository contains a NestJS 11 / TypeScript backend, MySQL 8.4, TypeORM migrations, JWT authentication and Socket.IO. There is no frontend application yet. The root README and several architecture/development documents are empty; this guide describes the implementation inspected, not an external product specification.

## What is implemented

| Frontend page | Backend capability | Main routes |
|---|---|---|
| Register / login | Argon2 password hashing, JWT login, current profile | POST /auth/register; POST /auth/login; GET /auth/profile; POST /auth/logout |
| Profile settings | Read/update your own profile | GET /users/:id; PATCH /users/:id |
| Workspace list/details | Create, list memberships, edit, archive/unarchive, soft delete | GET/POST /workspaces; GET/PATCH/DELETE /workspaces/:id; PATCH /workspaces/:id/archive and /unarchive |
| Workspace members | List/remove members, invite existing users, accept/reject/cancel invitation | GET /workspaces/:id/members; DELETE /workspaces/:id/members/:userId; POST /workspaces/:id/invitations; PATCH /workspaces/:id/invitations/:invitationId/{accept,reject,cancel} |
| Kanban board | Grouped tasks, WIP settings, controlled transitions | GET /workspaces/:workspaceId/board; GET/PATCH /workspaces/:id/kanban-settings; POST /workspaces/:workspaceId/tasks; GET/PATCH/DELETE /tasks/:id; POST /tasks/:id/transition |
| Task detail | Assignment, comments, dependencies, blocked state | GET/POST/DELETE /tasks/:id/assignment; GET/POST /tasks/:id/comments; PATCH/DELETE /tasks/:taskId/comments/:commentId; GET/POST /tasks/:id/dependencies; DELETE /tasks/:id/dependencies/:dependencyId; POST/DELETE /tasks/:id/block |
| Notes | Create, list, read, edit, delete notes | GET/POST /workspaces/:workspaceId/notes; GET/PATCH/DELETE /workspaces/:workspaceId/notes/:noteId |
| Files | Upload, list, metadata, authenticated download, delete | GET/POST /workspaces/:workspaceId/files; GET/DELETE /workspaces/:workspaceId/files/:fileId; GET /workspaces/:workspaceId/files/:fileId/download |
| Workspace chat | REST history/send plus Socket.IO delivery | GET/POST /workspaces/:workspaceId/messages |
| Direct messages | Open conversation with user ID, list/send/read messages | GET /direct-conversations; POST /direct-conversations/:userId; GET/POST /direct-conversations/:id/messages; PATCH /direct-conversations/:id/read |
| Notifications | List, unread count, mark one/all read | GET /notifications; GET /notifications/unread-count; PATCH /notifications/read-all; PATCH /notifications/:id/read |
| Activity feed | Workspace activity history | GET /workspaces/:workspaceId/activities |
| Diagnostics | Basic liveness, Swagger | GET /health; GET /api; GET /api-json |

All business routes require a bearer token except registration/login. Membership and ownership checks additionally apply. User profile endpoints are self-only. Workspace management operations enforce ownership. Do not infer missing capabilities from database entities: GitHub has entities but an empty controller/service scaffold; friendship has an entity but no friendship API. No user search/list API, invitation-list API, password-reset flow, refresh-token endpoint, or token revocation was found. Invitations currently require an existing user's UUID, which is a UX gap for a member picker.

## Link your pages

Base URL in local Docker development: http://localhost:3000. `/api` is the Swagger UI, NOT a prefix for business routes. Fetch `/workspaces`, not `/api/workspaces`.

Recommended starting structure: `apps/frontend` with TypeScript, shared API client, auth state, router, and feature folders. A React/Vite application is a reasonable option if your project subject permits it; confirm the team's framework constraints before choosing. Keep the existing Nest backend and database.

```ts
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(API + path, {...init, headers});
  const text = await response.text();
  let data: any;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  if (!response.ok) throw Object.assign(new Error(
    Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? `HTTP ${response.status}`
  ), {status: response.status});
  return data as T;
}
```

Register with `{username,email,password}` (username 3–30 characters, password at least 8). Registration returns a user, not a token. Then POST `/auth/login` with `{email,password}`; it returns `{accessToken}`. Load `/auth/profile`, then `/workspaces`. Pass `Authorization: Bearer <accessToken>` on protected requests. Keep token handling centralized; on 401 return to login. Tokens expire after 23 hours; no refresh endpoint exists. Logout currently returns success without invalidating JWTs: clear frontend auth state and disconnect sockets.

Workspace creation: `{name,description?}`. Task creation: `{title,description?,acceptanceCriteria?,priority?,dueAt?}`. Priority is LOW/MEDIUM/HIGH/URGENT. Dates use ISO date strings. Task states: BACKLOG, READY, IN_PROGRESS, REVIEW, DONE, CANCELLED. To drag a task, POST `/tasks/:id/transition` with `{toStatus:'READY',note?:'...'}`. Use the returned task and refetch the board. Handle 400 for disallowed transitions and 409 for WIP conflicts; revert optimistic moves. The board response includes `{workspaceId,activeWipLimit,activeCount,columns:[{status,tasks}]}`. Assignment POST body is `{userId}`. Comments and chat messages use `{content}`; block uses `{reason}`. Do not assume every status-to-status move is allowed.

Validation strips no unknown fields silently: unknown fields are rejected (400), UUID route parameters are validated. Responses are generally direct objects/arrays, not a universal `{data}` wrapper. Handle empty bodies (including 204). Query pagination differs by feature: inspect the corresponding `list-*.dto.ts` files before building infinite scroll.

File upload uses FormData with field `file` and optional `displayName`, maximum 10 MiB. Let the browser set the multipart Content-Type. Downloads require bearer auth, so use authenticated fetch + `response.blob()` and an object URL rather than a bare link. Files are stored under `apps/backend/storage/workspace-files` through the development bind mount.

Socket.IO uses the same backend origin and default namespace; use `socket.io-client`, not browser WebSocket directly:

```ts
const socket = io(API, {auth: {token: accessToken}});
socket.on('workspace-chat.ready', () => socket.emit('workspace-chat.join', workspaceId));
socket.on('workspace-message.created', message => upsertWorkspaceMessage(message));
socket.on('direct-message.created', message => upsertDirectMessage(message));
```

Send messages via REST. Deduplicate socket events and REST responses by message ID. Rejoin on reconnect, fetch missed history, disconnect on logout. There is no workspace leave event: reconnect when switching workspace if necessary to avoid retaining old room subscriptions. Notifications have REST endpoints; do not invent notification socket events.

## Integration gaps to resolve

1. No `app.enableCors()` in main.ts or explicit gateway CORS options. Separate frontend/backend origins need HTTP and Socket.IO CORS configuration, or a development reverse proxy that forwards business routes and `/socket.io` (including WebSocket upgrades). A proxy prefix must be stripped before reaching Nest. Never use `mode:'no-cors'` as a fix.
2. `.env.example` lacks JWT_SECRET although startup requires it. A local ignored `.env` with a generated secret was created for this audit. Add a documented placeholder to the example before teammates onboard.
3. Swagger is registered, but no Swagger compiler plugin or ApiProperty/ApiResponse DTO annotations were found. Runtime confirmed 63 operations and 19 schemas, all with zero properties; only 41 operations declare security. Treat it as route discovery, not a usable typed contract. Some protected controllers omit ApiBearerAuth. Do not generate a typed frontend client from empty schemas.
4. No user directory/search endpoint and no invitation list endpoint: agree with backend owner on how users discover invitees and pending invitations. Notifications contain invitation references, but this does not replace a full invitation management contract.
5. GitHub integration, friend management, password recovery, and session revocation are unfinished/absent. Avoid presenting these as working features.
6. Docker publishes `${APP_PORT}:3000` while Nest also listens on APP_PORT. Keep APP_PORT=3000 with the current compose file, or fix internal/external port handling before changing it.
7. `/health` returns a static response; it is not a database readiness probe. The existing e2e file only checks `Hello World!` and bypasses main.ts bootstrap validation/Swagger setup.
8. Do not run `make clean`/`make fclean`: these targets remove Docker resources across the machine, including other projects. Use project-scoped Docker Compose commands.

## Run and manually test

From WSL, repository root:

```bash
# For a new checkout only: copy .env.example to .env and add a random JWT_SECRET.
docker compose up -d --build
docker compose ps
docker compose exec -T backend npm run build
docker compose exec -T backend npm test -- --runInBand
docker compose exec -T backend npm run test:e2e -- --runInBand
docker compose exec -T backend node < scripts/api-smoke.cjs
```

The smoke script creates uniquely named local test users/workspace/files/messages and leaves them for inspection. It prints test credentials for that local account, never the JWT or database credentials. This is a development-only test, not suitable for production data. The Socket.IO room test allows a short wait for asynchronous join processing; it is not a load/race test.

Open http://localhost:3000/api. Register, login, copy only `accessToken` into Authorize, then call profile and workspaces. If Swagger omits auth on a protected operation, use curl/fetch with the bearer header or correct its ApiBearerAuth annotation. Check invalid payload (400), missing token (401), another user's profile (403), WIP rejection (409), file upload/download, and two-browser chat. The smoke script covers representative flows; it does not certify every permission edge case or production readiness.

## Skills and free MCP options

Skills are reusable agent instructions; MCP servers expose tools. Neither replaces a frontend library or becomes a dependency of the shipped app.

- Official OpenAI `playwright` / `playwright-interactive` skills: browser interaction, screenshots, smoke tests and debugging. Verified in the current skill-installer catalog. https://github.com/openai/skills/tree/main/skills/.curated/playwright and https://github.com/openai/skills/tree/main/skills/.curated/playwright-interactive
- Anthropic `frontend-design`: visual direction, typography and polished frontend UI. https://github.com/anthropics/skills/tree/main/skills/frontend-design
- The already available Figma design-to-code skill helps when you supply actual Figma screens; use generate-library/design skills for building a design system. These are conditional on choosing a Figma workflow.
- Official `security-best-practices`: useful when reviewing auth/token handling. Available in the current catalog. https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices

| MCP | Best use here | Cost/availability verified from primary source |
|---|---|---|
| Playwright MCP | Browser flows, forms, screenshots and UI regression exploration | Apache-2.0, local open-source server; no server subscription. https://github.com/microsoft/playwright-mcp |
| Chrome DevTools MCP | Network requests, CORS debugging, console errors and performance | Apache-2.0, local open-source server; no server subscription. https://github.com/ChromeDevTools/chrome-devtools-mcp |
| Context7 | Current docs/examples for the frontend libraries chosen | MIT project; free API key available with rate limits. Hosted use is not unlimited free service. https://github.com/upstash/context7 |

Agent/model usage and local computer resources are separate costs. Start with one browser tool plus Context7; both browser MCPs overlap. Existing browser tools may already cover our needs. Context7 was found in the plugin directory and suggested but has not been installed/connected. No skills or MCP servers were installed during this audit. Swagger UI and HTTP smoke tests do not require an additional MCP.

Build order: auth/profile → workspace list/details → board/task detail → notes/files → chat → notifications/invitations. Agree on the missing contracts with the backend owner before designing screens that depend on them.


## Verified readiness results

- Docker backend and MySQL are running; MySQL is healthy, migration service exited successfully, InitialSchema is applied.
- `npm run build`: passed.
- `npm test -- --runInBand`: 20 suites, 516 tests passed.
- `npm run test:e2e -- --runInBand`: failed before tests execute. Jest cannot require the ESM `@nestjs/config/dist/index.js` under the current Node 22/CommonJS test setup. Resolve compatible dependency/test configuration before relying on CI e2e results.
- Live smoke: 57 checks passed. Includes registration/login/profile; validation/auth rejection; workspace/task operations; WIP conflict; invitation notification/acceptance; outsider denial and member ownership restriction; notes; upload/download; chat and DM REST plus Socket.IO delivery; activities/notifications. See `api/SMOKE_RESULTS.txt` and `../scripts/api-smoke.cjs`.
- CORS preflight from localhost:5173: HTTP 404, no Access-Control-Allow-Origin. This is a confirmed direct browser integration blocker unless using a same-origin proxy.
- OpenAPI: 63 operations, 19 schemas, zero schemas with properties, 41 operations with security annotations. Improve Swagger decorators/compiler plugin and response metadata before client generation.
- `npm audit --omit=dev`: 6 dependency findings (3 high, 3 moderate; no production critical). High findings include transitive Multer/body-parser and the affected Nest Express adapter dependency chain. The complete install audit also reported 1 critical among development-inclusive dependencies. Findings are package audit results, not proof of exploitability; no automatic dependency upgrades were applied.

Verdict: enough working backend functionality to start the core frontend, using a proxy or coordinated CORS fix. It is not fully ready for production sign-off. Priorities for the backend owner: repair OpenAPI schemas/auth declarations, document JWT_SECRET, repair e2e tooling, update vulnerable dependency chains, and agree on user search/invitation discovery contracts. No application source was changed during this audit. Local `.env`, Docker resources, and smoke-test fixtures were created. Services were left running so Swagger can be tried immediately.
