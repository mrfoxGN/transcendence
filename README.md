*This project has been created as part of the 42 curriculum by noureddine, mrfoxGN, KHALEDHIHI.*

# DevUP

## Description

DevUP is a shared workspace for software teams. Teams plan work in a backlog and Kanban board, organize tasks into projects and milestones, and track progress with activity feeds and analytics. Team chat, direct messages, files, notes, and a GitHub repository integration keep the context close to the work.

## Instructions

1. Install Docker Engine or Docker Desktop with Docker Compose v2.24 or newer. Start Docker and make sure ports 443, 8080, and 3306 are available. Set `HTTPS_PORT`, `FRONTEND_PORT`, or `MYSQL_PORT` in an optional `.env` to use different ports. See [.env.example](.env.example) for the supported settings.
2. From the repository root, build and start the stack:

```sh
docker compose up --build
```

3. Open [DevUP](https://localhost) when the services are ready, or use the HTTPS port you configured. Compose starts MySQL, applies migrations, starts the API, and serves the frontend. Nginx redirects HTTP on port 8080 and serves the UI, API, and chat on the same HTTPS origin.
4. Create an account, choose an avatar, then create a workspace or join one by invitation. Use a second account to try invitations, assignments, and chat.
5. Stop the stack with `docker compose down`. Compose keeps the database and local TLS certificate in named volumes.

On first launch, the frontend generates a self-signed localhost certificate and keeps it in the `frontend_tls` volume. For warning-free local use, export only the public certificate with `docker compose cp frontend:/etc/nginx/tls/cert.pem ./devup-local-cert.pem` and trust it in the test browser or OS. Keep the private key in the volume.

Set `HTTPS_PORT` in `.env` if port 443 is occupied, and `FRONTEND_PORT` to change the HTTP redirect port. For a custom hostname, set `PUBLIC_ORIGIN` to the full HTTPS origin and use a Compose override to mount a trusted certificate chain and private key as `/etc/nginx/tls/cert.pem` and `/etc/nginx/tls/key.pem`. Compose derives account email links and the GitHub redirect URLs from that origin. Register the HTTPS callback at `/api/github/callback` in your GitHub OAuth app. Configure your own secrets before deploying outside local development.

Set `AUTH_EMAIL_FROM` and `RESEND_API_KEY` to enable account and invitation emails. Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` to enable the optional GitHub integration.

## Resources

- [React documentation](https://react.dev/learn) and [Vite documentation](https://vite.dev/guide/) for frontend development.
- [NestJS documentation](https://docs.nestjs.com/), [TypeORM documentation](https://typeorm.io/), and [MySQL documentation](https://dev.mysql.com/doc/) for the API and database.
- [Socket.IO documentation](https://socket.io/docs/v4/) for live messages and reconnection.
- [Docker Compose documentation](https://docs.docker.com/compose/) and [Nginx HTTPS configuration](https://nginx.org/en/docs/http/configuring_https_servers.html) for local launch and TLS.
- [Workspace improvement backlog](docs/development/WORKSPACE_IMPROVEMENT_BACKLOG.md) and [backend handoff](docs/development/WORKSPACE_BACKEND_HANDOFF.md) for project-specific decisions.

AI assistance was used to draft the workspace backlog, develop and review frontend workflows, implement and test backend changes for notifications and chat, diagnose browser console issues, configure Compose and HTTPS, and draft documentation. Git history records the commits associated with that work.

## Team Information

The names and responsibilities below come from Git history. Confirm the exact 42 Intra logins and formally assigned roles before submission.

| Contributor | Role in the repository | Responsibilities |
| --- | --- | --- |
| noureddine | Frontend and full-stack developer | DevUP interface, API integration, workspace workflows, account onboarding, and release fixes |
| mrfoxGN | Backend developer | NestJS and MySQL foundations, workspaces, file management, activity, notifications, and GitHub integration |
| KHALEDHIHI | Backend developer | Task workflows, notes, direct messaging, logout, and backend test maintenance |

## Project Management

Work was organized by feature area and then tracked as numbered workspace improvement tickets. The [backlog](docs/development/WORKSPACE_IMPROVEMENT_BACKLOG.md) records scope, acceptance checks, and implementation status. Git branches and commits record integration and per-ticket delivery. Repository handoff documents record API behavior and outstanding work. Meeting cadence and external communication channels are pending team confirmation.

## Technical Stack

| Layer | Technology and reason |
| --- | --- |
| Frontend | React and TypeScript for typed, reusable UI, Vite for builds, and dnd-kit for Kanban drag and drop |
| Backend | NestJS and TypeScript for domain modules, validation, and access checks, with REST endpoints and Swagger documentation |
| Database | MySQL 8.4 for transactions, relational constraints, and durable workspace history. TypeORM maps entities and applies migrations. |
| Live updates | Socket.IO for team and direct chat events, reconnect handling, and unread state updates |
| Local deployment | Docker Compose starts the stack in dependency order. Nginx terminates TLS and routes browser requests to the API. |

## Database Schema

The [TypeORM migrations](apps/backend/src/database/migrations/) define the schema. Most records use UUIDs stored as `CHAR(36)`. Timestamps use `DATETIME`, task deadlines use `DATE`, and structured settings and event metadata use `JSON`.

| Domain | Main records and relationships |
| --- | --- |
| Accounts and access | Users own workspaces and join other workspaces through membership records. Invitations belong to a workspace and record their recipient and outcome. |
| Planning | Tasks belong to workspaces. Assignments reference users, dependencies link tasks, and comments and status history reference their task. Projects group tasks and milestones. |
| Collaboration | Workspace messages reference a workspace and sender. Direct conversations pair two users and own their messages. Messages can reference a reply source and store an attachment. |
| Documents | Workspace files and notes belong to a workspace. Files can reference a task, and revisions belong to a note. |
| Activity and notifications | Activity records describe workspace events. Personal notifications reference a recipient, and notification preferences and task watchers govern delivery. |
| GitHub | Connected repositories belong to workspaces. Commit records reference their repository for workspace browsing and sync. |

## Features List

| Feature | What it does | Contributors |
| --- | --- | --- |
| Accounts and onboarding | Register, sign in, reset passwords, verify email, and set a profile avatar. | noureddine, KHALEDHIHI |
| Workspace and team management | Create and update workspaces, invite and remove members, and archive or restore a workspace. | mrfoxGN, noureddine |
| Backlog, Kanban, and projects | Create and assign tasks, track dependencies and blockers, move cards between columns, save backlog views, and group work by project and milestone. | KHALEDHIHI, mrfoxGN, noureddine |
| Team chat and direct messages | Send live messages, recover history after reconnect, reply, mention participants, search, and share attachments. | KHALEDHIHI, mrfoxGN, noureddine |
| Files and notes | Upload and manage workspace files, browse by search and sort, and edit notes with revision history. | mrfoxGN, KHALEDHIHI, noureddine |
| Notifications and activity | Review personal notifications and preferences, watch tasks, browse workspace activity, and review owner audit events. | mrfoxGN, noureddine |
| GitHub integration | Connect a public repository and review branches and synced commits. | mrfoxGN, noureddine |
| Workspace analytics | Review current workload, completion trends, cumulative flow, and time in task stages. | noureddine |

## Modules

The table maps the current implementation to Chapter IV. Major modules are worth 2 points and minor modules are worth 1 point. This is a proposed evaluation tally based on the repository. The team must confirm its final module selection.

| Chapter | Module | Type | Points | Implementation and rationale | Contributors |
| --- | --- | --- | ---: | --- | --- |
| IV.1 | Frontend and backend frameworks | Major | 2 | React renders the workspace UI, and NestJS serves the API. The two frameworks provide clear boundaries for frontend and backend work. | mrfoxGN, noureddine |
| IV.1 | Real-time features | Major | 2 | Socket.IO broadcasts chat events, tracks connections, and works with cursor-based history to recover missed messages after reconnect. | mrfoxGN, KHALEDHIHI, noureddine |
| IV.1 | ORM | Minor | 1 | TypeORM manages MySQL entities, migrations, relationships, and transactions for persistent application data. | mrfoxGN, KHALEDHIHI, noureddine |
| IV.1 | Custom design system | Minor | 1 | Shared colors, typography, and icons support reusable controls including buttons, fields, badges, avatars, panels, drawers, dialogs, menus, tabs, and filter controls. | noureddine |
| IV.1 | Advanced search | Minor | 1 | Backlog filters and saved views help narrow tasks. Files and Notes support server-side search, sorting, and pagination. | noureddine |
| IV.1 | File upload and management | Minor | 1 | Workspace file and chat attachment workflows validate uploads and check access before serving stored files. | mrfoxGN, noureddine |
| IV.3 | Organization system | Major | 2 | Workspaces support creation, updates, deletion, invitations, member removal, and task workflows scoped to membership. | mrfoxGN, noureddine |
| | **Proposed total** | | **10** | **4 points below the 14-point minimum.** | |

Additional features appear in the feature list. They do not add points here unless the full subject criteria are supported. For example, GitHub repository authorization is an integration and does not count as OAuth sign-in. Chat and profiles alone do not satisfy the user-interaction module's friends-system requirement.

## Individual Contributions

- **noureddine** built and integrated the workspace UI, implemented board placement and task editing, improved onboarding and project views, and added analytics, notification preferences, and chat collaboration. Preserving exact task placement and reconnecting without duplicate chat messages required changes across the API and frontend.
- **mrfoxGN** established the NestJS and MySQL foundation and implemented workspace ownership and membership, file management, notifications, activity history, team chat, and GitHub integration. GitHub sync moved to a manual flow, and file deletion gained retry logging for storage failures.
- **KHALEDHIHI** implemented direct conversations and real-time messaging, core task workflows and dependency rules, and workspace notes. Logout revokes tokens and disconnects chat sessions. Backend test and lint fixes support those changes.
