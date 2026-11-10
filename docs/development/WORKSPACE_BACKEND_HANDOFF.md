# DevUP workspace backend handoff

Snapshot: November 10, 2026. The workspace integration changes were local and uncommitted at handoff. The development frontend was running at [localhost:5173](http://localhost:5173). This handoff covers the signed-in workspace.

## What is connected

- **Tasks and board:** Board, Backlog, Home, Analytics, and command search share server-backed tasks. Task creation, edits, transitions, assignments, comments, dependencies, and blockers use the API. The board response includes assignee IDs, active work count, and the work-in-progress limit. The backend owns status transitions and counts both In progress and Review toward that limit.
- **Team and settings:** Workspace owners can invite existing DevUP users by email, view and cancel pending invitations, and remove members. Invitees can accept or decline from Notifications. Workspace name, description, archive state, and Kanban settings persist.
- **Chat:** Workspace and direct messages use REST for sending and history and Socket.IO for incoming messages. Direct conversations include server-backed unread counts. Workspace chat does not currently persist per-user read state.
- **GitHub, activity, files, and notes:** Repository selection, sync, branches, and commits use the GitHub integration. Activity shows the event types emitted by the backend. Files and notes support permission-aware deletion. File uploads are limited to 10 MiB.

## Setup and release checks

1. Run the backend and MySQL with Docker Compose. Apply migrations through the repository's migration workflow. Start the frontend with `npm --prefix apps/frontend run dev`.
2. Configure the deployed proxy to forward `/api/*` to Nest with the frontend's `/api` prefix stripped. Forward `/socket.io` with both HTTP polling and WebSocket upgrade support. Vite supplies this routing locally and in preview. The production host needs its own equivalent configuration.
3. For GitHub, set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL`, and `GITHUB_OAUTH_FRONTEND_URL` in the backend environment. Register the exact callback URL in GitHub. Set the frontend URL to the origin where the user signed into DevUP so the callback returns to the same browser session. Test authorization, eligible repository selection, sync, and failure recovery with a live GitHub account.
4. Before release, test with an owner, a member, and an unrelated account. Check workspace isolation, owner-only actions, invitation acceptance, chat reconnect and unread behavior, file access, and persistence after reload. Confirm the frontend reports permission and network errors without showing false success.

At handoff, both builds and all 583 backend tests passed. A two-account local smoke test verified task creation, assignment and transitions, invitation acceptance, and direct-message delivery and read state through the proxy. GitHub OAuth was not verified with a live account.

## Backend work still needed

| Feature | Backend requirement | Acceptance check |
| --- | --- | --- |
| Custom Kanban columns | Add workspace-owned column IDs, labels, ordering, and workflow rules. Migrate existing statuses. Define what happens to cards and history when a column is removed. Move affected cards and remove the column atomically. | Two members see the same columns after reload. Removing a populated column preserves every task and its history. |
| Voice and video calls | Choose a media stack. Add authorized call invitations, session signaling, and call lifecycle events. Configure STUN/TURN or a media provider as required. | Only conversation participants can join. Accept, decline, mute, camera toggle, leave, and reconnect work between two clients. |
| Chat reactions | Persist reactions by message, user, and emoji. Add permission-checked add/remove operations and broadcast changes to conversation participants. | Toggling is safe to retry and reaction totals agree across clients and reloads. |
| Mentions | Store mentions as user IDs tied to messages. Validate recipients against conversation membership. Emit mention notifications and support a mentions query. | A mentioned participant receives one notification that opens the correct conversation. Nonparticipants cannot be mentioned. |
| Chat attachments | Link authorized uploads to messages. Define access rules separately for workspace and direct conversations. Enforce file validation and size limits, and clean up abandoned uploads. | Authorized participants can open the attachment after reload. A copied attachment URL gives no access to outsiders. |
| Historical cycle-time reporting | Expose task status history or add an aggregate analytics endpoint. Define when the cycle starts and ends and how repeat transitions, cancellations, and date boundaries count. | The report reproduces known task timelines for the selected period, including tasks sent back from Review. |
| Workspace chat unread state | Store a read cursor per member and workspace and return unread counts with conversation metadata. | Unread workspace messages stay consistent across browsers and sessions. |
| Broader activity coverage | Emit events for changes such as GitHub sync, note edits, assignment, and blockers before adding corresponding feed filters. | Each supported filter shows real events and links to the right resource where available. |
| GitHub disconnect | Add an owner-authorized disconnect operation and define how it affects cached commits and credentials. | After disconnecting, the workspace returns to the repository setup state and sync is unavailable. |

Related documentation: [Backend architecture](../architecture/BACKEND_ARCHITECTURE.md), [API conventions](../api/API_CONVENTIONS.md), and [database migrations](DATABASE_MIGRATIONS.md).
