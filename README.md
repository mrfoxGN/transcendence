*This project has been created as part of the 42 curriculum by LOGIN_1, LOGIN_2, LOGIN_3.*

# DevUP

## Description

DevUP is a shared workspace for software teams. Teams plan work in a backlog and Kanban board, organize tasks into projects and milestones, and track progress with activity feeds and analytics. Team chat, direct messages, files, notes, and a GitHub repository integration keep the context close to the work.

## Instructions

1. Install Docker Engine, Docker Compose v2.24 or newer, and Make.
2. From the repository root, create your private configuration if it does not exist:

```sh
cp -n devops/.env.example .env
```

Set the database, JWT, Grafana and email settings in `.env`. Never commit secrets.
`PUBLIC_HOST`, `BIND_IP`, `HTTP_PORT`, `HTTPS_PORT`, and `GATUS_PORT` control
host-facing addresses. The defaults publish Nginx on localhost ports 80, 443 and 8443.
MySQL and Backend have no published host ports.

3. Build and start Production:

```sh
make build
make up
make status
```

Open [DevUP](https://localhost) and accept or explicitly trust the local self-signed
certificate. Create an account and workspace to start using the application.
Grafana is available at `/grafana/`, and the status page at `https://localhost:8443/`.
Use the configured host and ports if you changed `.env`.

4. Stop with `make down`. Named volumes and the root `backups/` directory are preserved.

All deployment configuration is organized under [devops/](devops/README.md), including
Dockerfiles, Compose, Nginx, monitoring, scripts and deployment documentation.
The root Makefile forwards commands to `devops/Makefile`. GitHub Actions must stay
under `.github/workflows/`; `.env` and local backups stay at the repository root.
Application build contexts retain their `.dockerignore` files under `apps/`.

Nginx serves the built Frontend and proxies Backend and Socket.IO on the same HTTPS
origin. TLS files are stored under ignored `devops/nginx/certs/`; keep the private key
secret. Backend's production image is shared with the one-shot migration service.

Automatic backups and restores currently cover **MySQL only**. Uploaded files remain
in their persistent volume but are not included in new backups. See the
[backup guide](devops/docs/BACKUP_AND_RESTORE.md) and
[local production guide](devops/docs/LOCAL_PRODUCTION.md).

## Resources

- [React documentation](https://react.dev/learn) and [Vite documentation](https://vite.dev/guide/) for frontend development.
- [NestJS documentation](https://docs.nestjs.com/), [TypeORM documentation](https://typeorm.io/), and [MySQL documentation](https://dev.mysql.com/doc/) for the API and database.
- [Socket.IO documentation](https://socket.io/docs/v4/) for live messages and reconnection.
- [Docker Compose documentation](https://docs.docker.com/compose/) and [Nginx HTTPS configuration](https://nginx.org/en/docs/http/configuring_https_servers.html) for local launch and TLS.
- [Workspace improvement backlog](docs/development/WORKSPACE_IMPROVEMENT_BACKLOG.md) and [backend handoff](docs/development/WORKSPACE_BACKEND_HANDOFF.md) for project-specific decisions.

AI assistance was used to draft the workspace backlog, develop and review frontend workflows, implement and test backend changes for notifications and chat, diagnose browser console issues, configure Compose and HTTPS, and draft documentation. Git history records the commits associated with that work.

## Team Information

Replace the login and role placeholders before submission. Git author names identify the contributions recorded in this repository.

| 42 Intra login | Git author | Assigned role | Responsibilities |
| --- | --- | --- | --- |
| `LOGIN_1` | noureddine | `ROLE_1` | DevUP interface, API integration, workspace workflows, account onboarding, and release fixes |
| `LOGIN_2` | mrfoxGN | `ROLE_2` | NestJS and MySQL foundations, workspaces, file management, activity, notifications, and GitHub integration |
| `LOGIN_3` | KHALEDHIHI | `ROLE_3` | Task workflows, notes, direct messaging, logout, and backend test maintenance |

## Project Management

Work was organized by feature area and then tracked as numbered workspace improvement tickets. The [backlog](docs/development/WORKSPACE_IMPROVEMENT_BACKLOG.md) records scope, acceptance checks, and implementation status. Git branches and commits record integration and per-ticket delivery. Repository handoff documents record API behavior and outstanding work.

- Meeting cadence: `MEETING_CADENCE`
- Team communication channels: `COMMUNICATION_CHANNELS`

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


## Current backend and frontend integration audit

See [Backend audit and API inventory](docs/backend-audit/README.md) for the
2026-11-23 `main` snapshot: current features, 112 controller operations, DTOs,
Socket.IO events, permissions and frontend migration notes. This supersedes the
older handoff's feature-absence claims; it is a static source audit, not a new
runtime test result.
