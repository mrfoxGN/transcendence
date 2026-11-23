# Socket.IO contract

Sources: [WorkspaceChatGateway](../../apps/backend/src/modules/chat/gateways/workspace-chat.gateway.ts),
[DirectChatGateway](../../apps/backend/src/modules/social/gateways/direct-chat.gateway.ts).

Both gateways use `@WebSocketGateway()` with no custom namespace or path. Connect
using `socket.io-client` to the existing application origin, default `/socket.io`.
The Nginx and Vite configurations forward transport upgrades. Native browser
`WebSocket` is not a replacement for the Socket.IO protocol.

## Authentication and lifecycle

Handshake: `auth: {token: accessToken}`. Missing/invalid token, missing JWT subject,
expiry or tokenVersion, disabled/deleted user, expired token or changed token
version disconnects the socket. The server checks expiry and disconnects when the
session expires. Successful workspace-gateway authentication joins the private
`user:<userId>` room and emits `workspace-chat.ready` with no payload.

On membership removal the server evicts that user from the workspace's message
and unread rooms. Revalidate membership after reconnect rather than treating an
old successful subscription as permanent authorization.

Logout, password changes and password reset revoke/disconnect relevant sessions.
Clear client state and close sockets on sign-out; do not keep a stale background
socket after a failed authenticated HTTP request.

## Client-to-server subscriptions

| Event | Payload | Result/behavior |
|---|---|---|
| `workspace-chat.join` | Workspace UUID string | Membership checked; joins active message room; boolean acknowledgement |
| `workspace-chat.watch` | Workspace UUID string | Membership checked; joins unread-notification room; triggers unread-changed event |
| `workspace-chat.leave` | Workspace UUID string | Leaves active message room and clears active workspace if matching |

`leave` does not leave the unread room. `watch` can be used to retain unread updates
for an accessible workspace while another is active. Rejoin after reconnection;
leave the old active room when switching workspaces.

## Server-to-client events

| Event | Payload | Scope / use |
|---|---|---|
| `workspace-chat.ready` | none | Session is authenticated; now subscribe |
| `workspace-message.created` | `ChatMessageResponseDto` | Active workspace room; merge by message ID |
| `workspace-chat.unread-changed` | workspace UUID string | Watched workspace, excluding current active room; refetch unread count |
| `workspace-chat.read` | workspace UUID string | User room, synchronizes read state across sessions |
| `direct-message.created` | `DirectMessageResponseDto` | Both conversation participants' user rooms |
| `direct-chat.read` | none | User room; refetch conversation/unread state |

Send messages through REST (`POST /workspaces/:workspaceId/messages` or
`POST /direct-conversations/:id/messages`), not an invented socket send event.
Use a UUID v4 `requestId` for idempotent sends, and merge the HTTP response plus
socket event by message ID. Refetch paginated history after reconnect to fill any
gap. A socket event is not a replacement for checking the POST result.

No typing, presence, reactions, message-edit/delete, note-update, generic task
update or notification-created socket event is defined in these gateways. Keep
REST refresh behavior for features without real-time contracts.

## Example wiring

```ts
const socket = io(window.location.origin, { auth: { token: accessToken } });
socket.on('workspace-chat.ready', () => {
  socket.emit('workspace-chat.join', workspaceId, joined => {
    if (joined) refreshWorkspaceMessages();
  });
  socket.emit('workspace-chat.watch', workspaceId);
});
socket.on('workspace-message.created', upsertWorkspaceMessageById);
socket.on('workspace-chat.unread-changed', refreshWorkspaceUnreadCount);
socket.on('workspace-chat.read', refreshWorkspaceReadState);
socket.on('direct-message.created', upsertDirectMessageById);
socket.on('direct-chat.read', refreshDirectConversations);
// On workspace switch: leave the previous active workspace, then join the next.
// On logout/unmount: remove handlers and disconnect.
```

This is illustrative wiring, not a new implementation committed to the frontend.
Production code must use current state safely and clean up event handlers.
