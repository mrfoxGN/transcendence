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

export enum WebhookStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  IGNORED = 'IGNORED',
}
