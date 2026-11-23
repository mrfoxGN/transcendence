# Schema and configuration inventory

Static snapshot at backend source tree `13bd89ecb88de422feabd64a9f474ece71d65435`. Migration files are present; this audit did not execute them or assert a deployed database schema.

## Enums

[apps/backend/src/database/enums/database.enums.ts:1](../../apps/backend/src/database/enums/database.enums.ts#L1)

```ts
export enum AppRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum GitHubAccountType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
}

export enum GitHubInstallationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum RepositoryVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  INTERNAL = 'INTERNAL',
}

export enum RepositoryEntryType {
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY',
  SYMLINK = 'SYMLINK',
  SUBMODULE = 'SUBMODULE',
}

export enum TaskRepositoryLinkType {
  REPOSITORY = 'REPOSITORY',
  BRANCH = 'BRANCH',
  FILE = 'FILE',
  COMMIT = 'COMMIT',
}
```

## Migration files

- [apps/backend/src/database/migrations/1789763235441-InitialSchema.ts:1](../../apps/backend/src/database/migrations/1789763235441-InitialSchema.ts#L1)
- [apps/backend/src/database/migrations/1793491200000-AddUserTokenVersion.ts:1](../../apps/backend/src/database/migrations/1793491200000-AddUserTokenVersion.ts#L1)
- [apps/backend/src/database/migrations/1793900000000-AddRepositoryEncryptedOAuthToken.ts:1](../../apps/backend/src/database/migrations/1793900000000-AddRepositoryEncryptedOAuthToken.ts#L1)
- [apps/backend/src/database/migrations/1794300000000-AddBoardColumns.ts:1](../../apps/backend/src/database/migrations/1794300000000-AddBoardColumns.ts#L1)
- [apps/backend/src/database/migrations/1794400000000-AddWorkspaceChatReadCursor.ts:1](../../apps/backend/src/database/migrations/1794400000000-AddWorkspaceChatReadCursor.ts#L1)
- [apps/backend/src/database/migrations/1794500000000-AddTaskDueDate.ts:1](../../apps/backend/src/database/migrations/1794500000000-AddTaskDueDate.ts#L1)
- [apps/backend/src/database/migrations/1794600000000-AddSavedBacklogViews.ts:1](../../apps/backend/src/database/migrations/1794600000000-AddSavedBacklogViews.ts#L1)
- [apps/backend/src/database/migrations/1794700000000-AddReadableTaskNumber.ts:1](../../apps/backend/src/database/migrations/1794700000000-AddReadableTaskNumber.ts#L1)
- [apps/backend/src/database/migrations/1794800000000-AddAccountRecovery.ts:1](../../apps/backend/src/database/migrations/1794800000000-AddAccountRecovery.ts#L1)
- [apps/backend/src/database/migrations/1794900000000-ExpandAvatarStorage.ts:1](../../apps/backend/src/database/migrations/1794900000000-ExpandAvatarStorage.ts#L1)
- [apps/backend/src/database/migrations/1795000000000-AddWorkspaceAndPersonalPreferences.ts:1](../../apps/backend/src/database/migrations/1795000000000-AddWorkspaceAndPersonalPreferences.ts#L1)
- [apps/backend/src/database/migrations/1795100000000-AddWorkspaceProjects.ts:1](../../apps/backend/src/database/migrations/1795100000000-AddWorkspaceProjects.ts#L1)
- [apps/backend/src/database/migrations/1795200000000-AddNoteRevisions.ts:1](../../apps/backend/src/database/migrations/1795200000000-AddNoteRevisions.ts#L1)
- [apps/backend/src/database/migrations/1795300000000-AddNotificationPreferencesAndWatchers.ts:1](../../apps/backend/src/database/migrations/1795300000000-AddNotificationPreferencesAndWatchers.ts#L1)
- [apps/backend/src/database/migrations/1795400000000-AddChatCollaboration.ts:1](../../apps/backend/src/database/migrations/1795400000000-AddChatCollaboration.ts#L1)
- [apps/backend/src/database/migrations/1795500000000-AddEmailVerificationCodes.ts:1](../../apps/backend/src/database/migrations/1795500000000-AddEmailVerificationCodes.ts#L1)
- [apps/backend/src/database/migrations/1795600000000-AddTaskStatusTodo.ts:1](../../apps/backend/src/database/migrations/1795600000000-AddTaskStatusTodo.ts#L1)
- [apps/backend/src/database/migrations/1795600000000-AddTwoFactorAuthentication.ts:1](../../apps/backend/src/database/migrations/1795600000000-AddTwoFactorAuthentication.ts#L1)

Two migrations share the numeric timestamp `1795600000000`. This is a source observation, not a tested migration failure; verify migration ordering in an isolated environment before deployment.

## Entity files

- [apps/backend/src/modules/activities/entities/activity.entity.ts:1](../../apps/backend/src/modules/activities/entities/activity.entity.ts#L1)
- [apps/backend/src/modules/chat/entities/chat-message.entity.ts:1](../../apps/backend/src/modules/chat/entities/chat-message.entity.ts#L1)
- [apps/backend/src/modules/files/entities/workspace-file.entity.ts:1](../../apps/backend/src/modules/files/entities/workspace-file.entity.ts#L1)
- [apps/backend/src/modules/github/entities/github-account.entity.ts:1](../../apps/backend/src/modules/github/entities/github-account.entity.ts#L1)
- [apps/backend/src/modules/github/entities/github-installation.entity.ts:1](../../apps/backend/src/modules/github/entities/github-installation.entity.ts#L1)
- [apps/backend/src/modules/github/entities/repository-commit.entity.ts:1](../../apps/backend/src/modules/github/entities/repository-commit.entity.ts#L1)
- [apps/backend/src/modules/github/entities/repository-entry.entity.ts:1](../../apps/backend/src/modules/github/entities/repository-entry.entity.ts#L1)
- [apps/backend/src/modules/github/entities/repository.entity.ts:1](../../apps/backend/src/modules/github/entities/repository.entity.ts#L1)
- [apps/backend/src/modules/github/entities/task-repository-link.entity.ts:1](../../apps/backend/src/modules/github/entities/task-repository-link.entity.ts#L1)
- [apps/backend/src/modules/notes/entities/note.entity.ts:1](../../apps/backend/src/modules/notes/entities/note.entity.ts#L1)
- [apps/backend/src/modules/notifications/entities/notification.entity.ts:1](../../apps/backend/src/modules/notifications/entities/notification.entity.ts#L1)
- [apps/backend/src/modules/social/entities/direct-conversation.entity.ts:1](../../apps/backend/src/modules/social/entities/direct-conversation.entity.ts#L1)
- [apps/backend/src/modules/social/entities/direct-message.entity.ts:1](../../apps/backend/src/modules/social/entities/direct-message.entity.ts#L1)
- [apps/backend/src/modules/social/entities/friendship.entity.ts:1](../../apps/backend/src/modules/social/entities/friendship.entity.ts#L1)
- [apps/backend/src/modules/tasks/entities/task-assignment.entity.ts:1](../../apps/backend/src/modules/tasks/entities/task-assignment.entity.ts#L1)
- [apps/backend/src/modules/tasks/entities/task-comment.entity.ts:1](../../apps/backend/src/modules/tasks/entities/task-comment.entity.ts#L1)
- [apps/backend/src/modules/tasks/entities/task-dependency.entity.ts:1](../../apps/backend/src/modules/tasks/entities/task-dependency.entity.ts#L1)
- [apps/backend/src/modules/tasks/entities/task-status-history.entity.ts:1](../../apps/backend/src/modules/tasks/entities/task-status-history.entity.ts#L1)
- [apps/backend/src/modules/tasks/entities/task.entity.ts:1](../../apps/backend/src/modules/tasks/entities/task.entity.ts#L1)
- [apps/backend/src/modules/users/entities/user.entity.ts:1](../../apps/backend/src/modules/users/entities/user.entity.ts#L1)
- [apps/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:1](../../apps/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts#L1)
- [apps/backend/src/modules/workspaces/entities/workspace-kanban-setting.entity.ts:1](../../apps/backend/src/modules/workspaces/entities/workspace-kanban-setting.entity.ts#L1)
- [apps/backend/src/modules/workspaces/entities/workspace-membership.entity.ts:1](../../apps/backend/src/modules/workspaces/entities/workspace-membership.entity.ts#L1)
- [apps/backend/src/modules/workspaces/entities/workspace.entity.ts:1](../../apps/backend/src/modules/workspaces/entities/workspace.entity.ts#L1)

## Environment variable names read by backend source

Names only; no secrets or `.env` values were inspected or copied. Runtime requirements vary by feature.

`APP_PORT`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `DB_USER`, `GITHUB_OAUTH_FRONTEND_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

See [feature guide](FEATURES.md) for authentication/email/OAuth requirements and [migration notes](MIGRATION.md) before starting another Compose stack.
