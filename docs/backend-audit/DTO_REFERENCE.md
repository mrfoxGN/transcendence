# DTO and validation reference

Exact source snapshots for 56 DTO files at backend source tree `13bd89ecb88de422feabd64a9f474ece71d65435`. Regenerate after backend changes. Optionality, nullability, enum values, length limits and transforms below are authoritative source declarations; service-level checks still apply.

Class-level validation uses whitelist + forbidNonWhitelisted + transform. Do not infer accepted request fields from response DTOs. Inline controller contracts follow the DTO files.

## modules/activities/dto/activity-response.dto.ts

[apps/backend/src/modules/activities/dto/activity-response.dto.ts:1](../../apps/backend/src/modules/activities/dto/activity-response.dto.ts#L1)

```ts
export class ActivityResponseDto {
  id!: string;
  workspaceId!: string;
  actorUserId!: string | null;
  actorName?: string;
  subjectName?: string;
  actionType!: string;
  resourceType!: string | null;
  resourceId!: string | null;
  resourceState?: 'available' | 'deleted';
  metadata!: unknown;
  createdAt!: Date;
}
```

## modules/activities/dto/list-activities.dto.ts

[apps/backend/src/modules/activities/dto/list-activities.dto.ts:1](../../apps/backend/src/modules/activities/dto/list-activities.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const activityCategories = ['tasks', 'files', 'members', 'notes', 'board', 'github'] as const;

export class ListActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(activityCategories)
  category?: (typeof activityCategories)[number];

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;
}
```

## modules/auth/dto/change-password.dto.ts

[apps/backend/src/modules/auth/dto/change-password.dto.ts:1](../../apps/backend/src/modules/auth/dto/change-password.dto.ts#L1)

```ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

## modules/auth/dto/confirm-email-verification.dto.ts

[apps/backend/src/modules/auth/dto/confirm-email-verification.dto.ts:1](../../apps/backend/src/modules/auth/dto/confirm-email-verification.dto.ts#L1)

```ts
import { IsNumberString, Length } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
```

## modules/auth/dto/confirm-enable-two-factor.dto.ts

[apps/backend/src/modules/auth/dto/confirm-enable-two-factor.dto.ts:1](../../apps/backend/src/modules/auth/dto/confirm-enable-two-factor.dto.ts#L1)

```ts
import { IsNumberString, Length } from 'class-validator';

export class ConfirmEnableTwoFactorDto {
  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
```

## modules/auth/dto/confirm-password-reset.dto.ts

[apps/backend/src/modules/auth/dto/confirm-password-reset.dto.ts:1](../../apps/backend/src/modules/auth/dto/confirm-password-reset.dto.ts#L1)

```ts
import {
  IsEmail,
  IsNumberString,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  email!: string;

  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

## modules/auth/dto/confirm-two-factor.dto.ts

[apps/backend/src/modules/auth/dto/confirm-two-factor.dto.ts:1](../../apps/backend/src/modules/auth/dto/confirm-two-factor.dto.ts#L1)

```ts
import { IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

export class ConfirmTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
```

## modules/auth/dto/login-response.dto.ts

[apps/backend/src/modules/auth/dto/login-response.dto.ts:1](../../apps/backend/src/modules/auth/dto/login-response.dto.ts#L1)

```ts
export class LoginResponseDto {
  accessToken?: string;
  twoFactorRequired?: boolean;
  twoFactorToken?: string;
}
```

## modules/auth/dto/login.dto.ts

[apps/backend/src/modules/auth/dto/login.dto.ts:1](../../apps/backend/src/modules/auth/dto/login.dto.ts#L1)

```ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
```

## modules/auth/dto/request-password-reset.dto.ts

[apps/backend/src/modules/auth/dto/request-password-reset.dto.ts:1](../../apps/backend/src/modules/auth/dto/request-password-reset.dto.ts#L1)

```ts
import { IsEmail, IsString } from 'class-validator';

export class RequestPasswordResetDto {
  @IsString()
  @IsEmail()
  email!: string;
}
```

## modules/auth/dto/resend-two-factor.dto.ts

[apps/backend/src/modules/auth/dto/resend-two-factor.dto.ts:1](../../apps/backend/src/modules/auth/dto/resend-two-factor.dto.ts#L1)

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class ResendTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;
}
```

## modules/chat/dto/chat-message-response.dto.ts

[apps/backend/src/modules/chat/dto/chat-message-response.dto.ts:1](../../apps/backend/src/modules/chat/dto/chat-message-response.dto.ts#L1)

```ts
export class ChatMessageResponseDto {
  id!: string;
  workspaceId!: string;
  senderId!: string | null;
  content!: string;
  createdAt!: Date;
  reply?: { id: string; senderId: string | null; preview: string; unavailable: boolean };
}
```

## modules/chat/dto/list-chat-messages.dto.ts

[apps/backend/src/modules/chat/dto/list-chat-messages.dto.ts:1](../../apps/backend/src/modules/chat/dto/list-chat-messages.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Max, Min } from 'class-validator';

export class ListChatMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## modules/chat/dto/send-chat-message.dto.ts

[apps/backend/src/modules/chat/dto/send-chat-message.dto.ts:1](../../apps/backend/src/modules/chat/dto/send-chat-message.dto.ts#L1)

```ts
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Message content cannot be blank' })
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
```

## modules/files/dto/list-workspace-files.dto.ts

[apps/backend/src/modules/files/dto/list-workspace-files.dto.ts:1](../../apps/backend/src/modules/files/dto/list-workspace-files.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListWorkspaceFilesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## modules/files/dto/rename-workspace-file.dto.ts

[apps/backend/src/modules/files/dto/rename-workspace-file.dto.ts:1](../../apps/backend/src/modules/files/dto/rename-workspace-file.dto.ts#L1)

```ts
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RenameWorkspaceFileDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @Matches(/^[^\x00-\x1f\x7f/\\]+$/, {
    message: 'Enter a filename without slashes or control characters.',
  })
  displayName!: string;
}
```

## modules/files/dto/upload-workspace-file.dto.ts

[apps/backend/src/modules/files/dto/upload-workspace-file.dto.ts:1](../../apps/backend/src/modules/files/dto/upload-workspace-file.dto.ts#L1)

```ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UploadWorkspaceFileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
```

## modules/files/dto/workspace-file-response.dto.ts

[apps/backend/src/modules/files/dto/workspace-file-response.dto.ts:1](../../apps/backend/src/modules/files/dto/workspace-file-response.dto.ts#L1)

```ts
export class WorkspaceFileResponseDto {
  id!: string;
  workspaceId!: string;
  uploaderId!: string | null;
  taskId!: string | null;
  originalName!: string;
  displayName!: string;
  mimeType!: string | null;
  sizeBytes!: string;
  createdAt!: Date;
}
```

## modules/github/dto/connect-repository.dto.ts

[apps/backend/src/modules/github/dto/connect-repository.dto.ts:1](../../apps/backend/src/modules/github/dto/connect-repository.dto.ts#L1)

```ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ConnectRepositoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  setupSessionId!: string;

  @IsString()
  @Matches(/^[0-9]{1,32}$/)
  githubRepositoryId!: string;
}
```

## modules/github/dto/connected-repository-response.dto.ts

[apps/backend/src/modules/github/dto/connected-repository-response.dto.ts:1](../../apps/backend/src/modules/github/dto/connected-repository-response.dto.ts#L1)

```ts
import { RepositoryVisibility } from '../../../database/enums/database.enums';

export class ConnectedRepositoryResponseDto {
  id!: string;
  workspaceId!: string;
  githubRepositoryId!: string;
  fullName!: string;
  repositoryUrl!: string;
  defaultBranch!: string;
  visibility!: RepositoryVisibility;
  createdAt!: Date;
}
```

## modules/github/dto/list-available-repositories.dto.ts

[apps/backend/src/modules/github/dto/list-available-repositories.dto.ts:1](../../apps/backend/src/modules/github/dto/list-available-repositories.dto.ts#L1)

```ts
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListAvailableRepositoriesDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  setupSessionId!: string;
}
```

## modules/notes/dto/create-note.dto.ts

[apps/backend/src/modules/notes/dto/create-note.dto.ts:1](../../apps/backend/src/modules/notes/dto/create-note.dto.ts#L1)

```ts
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string | null;
}
```

## modules/notes/dto/list-notes.dto.ts

[apps/backend/src/modules/notes/dto/list-notes.dto.ts:1](../../apps/backend/src/modules/notes/dto/list-notes.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## modules/notes/dto/note-response.dto.ts

[apps/backend/src/modules/notes/dto/note-response.dto.ts:1](../../apps/backend/src/modules/notes/dto/note-response.dto.ts#L1)

```ts
export class NoteResponseDto {
  id!: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  content!: string | null;
  pinnedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
```

## modules/notes/dto/update-note.dto.ts

[apps/backend/src/modules/notes/dto/update-note.dto.ts:1](../../apps/backend/src/modules/notes/dto/update-note.dto.ts#L1)

```ts
import { IsBoolean, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class UpdateNoteDto {
  @ValidateIf((dto: UpdateNoteDto) => dto.title !== undefined)
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
```

## modules/notifications/dto/list-notifications.dto.ts

[apps/backend/src/modules/notifications/dto/list-notifications.dto.ts:1](../../apps/backend/src/modules/notifications/dto/list-notifications.dto.ts#L1)

```ts
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { notificationCategories } from '../notification-events';

export class ListNotificationsDto {
  @IsOptional()
  @IsIn(Object.keys(notificationCategories))
  category?: keyof typeof notificationCategories;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => {
    const input: unknown = value;

    if (input === 'true') {
      return true;
    }

    if (input === 'false') {
      return false;
    }

    return input;
  })
  @IsBoolean()
  unreadOnly?: boolean;
}
```

## modules/notifications/dto/notification-response.dto.ts

[apps/backend/src/modules/notifications/dto/notification-response.dto.ts:1](../../apps/backend/src/modules/notifications/dto/notification-response.dto.ts#L1)

```ts
export class NotificationResponseDto {
  id!: string;
  workspaceId!: string | null;
  type!: string;
  message!: string;
  relatedResourceType!: string | null;
  relatedResourceId!: string | null;
  payload!: unknown;
  createdAt!: Date;
  invitationStatus?: string;
  readAt!: Date | null;
}
```

## modules/social/dto/direct-conversation-response.dto.ts

[apps/backend/src/modules/social/dto/direct-conversation-response.dto.ts:1](../../apps/backend/src/modules/social/dto/direct-conversation-response.dto.ts#L1)

```ts
export class DirectConversationResponseDto {
  id!: string;
  otherUserId!: string;
  otherUsername?: string;
  unreadCount?: number;
  lastMessageAt!: Date | null;
  createdAt!: Date;
}
```

## modules/social/dto/direct-message-response.dto.ts

[apps/backend/src/modules/social/dto/direct-message-response.dto.ts:1](../../apps/backend/src/modules/social/dto/direct-message-response.dto.ts#L1)

```ts
export class DirectMessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  content!: string;
  createdAt!: Date;
  reply?: {
    id: string;
    senderId: string | null;
    preview: string;
    unavailable: boolean;
  };
}
```

## modules/social/dto/list-direct-messages.dto.ts

[apps/backend/src/modules/social/dto/list-direct-messages.dto.ts:1](../../apps/backend/src/modules/social/dto/list-direct-messages.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListDirectMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## modules/social/dto/send-direct-message.dto.ts

[apps/backend/src/modules/social/dto/send-direct-message.dto.ts:1](../../apps/backend/src/modules/social/dto/send-direct-message.dto.ts#L1)

```ts
import { IsNotEmpty, IsUUID, IsOptional, IsString } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
```

## modules/tasks/dto/assign-task.dto.ts

[apps/backend/src/modules/tasks/dto/assign-task.dto.ts:1](../../apps/backend/src/modules/tasks/dto/assign-task.dto.ts#L1)

```ts
import { IsUUID } from 'class-validator';

export class AssignTaskDto {
  @IsUUID()
  userId!: string;
}
```

## modules/tasks/dto/block-task.dto.ts

[apps/backend/src/modules/tasks/dto/block-task.dto.ts:1](../../apps/backend/src/modules/tasks/dto/block-task.dto.ts#L1)

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class BlockTaskDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
```

## modules/tasks/dto/create-task-comment.dto.ts

[apps/backend/src/modules/tasks/dto/create-task-comment.dto.ts:1](../../apps/backend/src/modules/tasks/dto/create-task-comment.dto.ts#L1)

```ts
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
```

## modules/tasks/dto/create-task-dependency.dto.ts

[apps/backend/src/modules/tasks/dto/create-task-dependency.dto.ts:1](../../apps/backend/src/modules/tasks/dto/create-task-dependency.dto.ts#L1)

```ts
import { IsUUID } from 'class-validator';

export class CreateTaskDependencyDto {
  @IsUUID()
  dependsOnTaskId!: string;
}
```

## modules/tasks/dto/create-task.dto.ts

[apps/backend/src/modules/tasks/dto/create-task.dto.ts:1](../../apps/backend/src/modules/tasks/dto/create-task.dto.ts#L1)

```ts
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

import { TaskPriority } from '../../../database/enums/database.enums';

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dueDate?: string | null;
}
```

## modules/tasks/dto/task-assignment-response.dto.ts

[apps/backend/src/modules/tasks/dto/task-assignment-response.dto.ts:1](../../apps/backend/src/modules/tasks/dto/task-assignment-response.dto.ts#L1)

```ts
export class TaskAssignmentResponseDto {
  id!: string;
  taskId!: string;
  userId!: string;
  assignedById!: string | null;
  assignedAt!: Date;
}
```

## modules/tasks/dto/task-board-response.dto.ts

[apps/backend/src/modules/tasks/dto/task-board-response.dto.ts:1](../../apps/backend/src/modules/tasks/dto/task-board-response.dto.ts#L1)

```ts
import { TaskStatus } from '../../../database/enums/database.enums';
import { TaskResponseDto } from './task-response.dto';

export class TaskBoardColumnDto {
  status!: TaskStatus;
  tasks!: TaskResponseDto[];
}

export class TaskBoardResponseDto {
  workspaceId!: string;
  reportingTimeZone!: string;
  activeWipLimit!: number;
  activeCount!: number;
  columns!: TaskBoardColumnDto[];
  assigneesByTaskId!: Record<string, string>;
}
```

## modules/tasks/dto/task-comment-response.dto.ts

[apps/backend/src/modules/tasks/dto/task-comment-response.dto.ts:1](../../apps/backend/src/modules/tasks/dto/task-comment-response.dto.ts#L1)

```ts
export class TaskCommentResponseDto {
  id!: string;
  taskId!: string;
  authorId!: string | null;
  content!: string;
  createdAt!: Date;
  updatedAt!: Date;
  editedAt!: Date | null;
}
```

## modules/tasks/dto/task-dependency-response.dto.ts

[apps/backend/src/modules/tasks/dto/task-dependency-response.dto.ts:1](../../apps/backend/src/modules/tasks/dto/task-dependency-response.dto.ts#L1)

```ts
export class TaskDependencyResponseDto {
  id!: string;
  taskId!: string;
  dependsOnTaskId!: string;
  createdById!: string | null;
  createdAt!: Date;
}
```

## modules/tasks/dto/task-response.dto.ts

[apps/backend/src/modules/tasks/dto/task-response.dto.ts:1](../../apps/backend/src/modules/tasks/dto/task-response.dto.ts#L1)

```ts
import {
  TaskPriority,
  TaskStatus,
} from '../../../database/enums/database.enums';

export class TaskResponseDto {
  id!: string;
  taskKey?: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  description!: string | null;
  acceptanceCriteria!: string | null;
  status!: TaskStatus;
  priority!: TaskPriority | null;
  position!: number;
  isBlocked!: boolean;
  blockedReason!: string | null;
  blockedAt!: Date | null;
  dueAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  completedAt!: Date | null;
  cancelledAt!: Date | null;
}
```

## modules/tasks/dto/transition-task.dto.ts

[apps/backend/src/modules/tasks/dto/transition-task.dto.ts:1](../../apps/backend/src/modules/tasks/dto/transition-task.dto.ts#L1)

```ts
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { TaskStatus } from '../../../database/enums/database.enums';

export class TransitionTaskDto {
  @IsEnum(TaskStatus)
  toStatus!: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
```

## modules/tasks/dto/update-task.dto.ts

[apps/backend/src/modules/tasks/dto/update-task.dto.ts:1](../../apps/backend/src/modules/tasks/dto/update-task.dto.ts#L1)

```ts
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

import { TaskPriority } from '../../../database/enums/database.enums';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dueDate?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  position?: number;
}
```

## modules/users/dto/create-user.dto.ts

[apps/backend/src/modules/users/dto/create-user.dto.ts:1](../../apps/backend/src/modules/users/dto/create-user.dto.ts#L1)

```ts
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 30)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

## modules/users/dto/update-profile.dto.ts

[apps/backend/src/modules/users/dto/update-profile.dto.ts:1](../../apps/backend/src/modules/users/dto/update-profile.dto.ts#L1)

```ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  @IsOptional()
  @IsBoolean()
  notificationBadge?: boolean;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(32791)
  @Matches(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarImage?: string;
}
```

## modules/users/dto/user-response.dto.ts

[apps/backend/src/modules/users/dto/user-response.dto.ts:1](../../apps/backend/src/modules/users/dto/user-response.dto.ts#L1)

```ts
import { AppRole, UserStatus } from '../../../database/enums/database.enums';

export class UserResponseDto {
  id!: string; // UUID, not number
  username!: string;
  email!: string;
  emailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  theme?: 'system' | 'light' | 'dark';
  notificationBadge?: boolean;
  avatarUrl!: string | null;
  appRole!: AppRole; // actual entity field
  status!: UserStatus; // actual entity field
  createdAt!: Date;
  updatedAt!: Date;
}
```

## modules/workspaces/dto/create-workspace-invitation.dto.ts

[apps/backend/src/modules/workspaces/dto/create-workspace-invitation.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/create-workspace-invitation.dto.ts#L1)

```ts
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceInvitationDto {
  @IsOptional()
  @IsUUID()
  invitedUserId?: string;

  @IsOptional()
  @IsEmail()
  invitedEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  invitedUsername?: string;
}
```

## modules/workspaces/dto/create-workspace.dto.ts

[apps/backend/src/modules/workspaces/dto/create-workspace.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/create-workspace.dto.ts#L1)

```ts
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

## modules/workspaces/dto/project.dto.ts

[apps/backend/src/modules/workspaces/dto/project.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/project.dto.ts#L1)

```ts
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export const projectStatuses = ['planned', 'active', 'on-hold', 'completed'] as const;
export type ProjectStatus = typeof projectStatuses[number];

export class MilestoneDto {
  @IsString()
  @Length(1, 120)
  @Matches(/\S/, { message: 'Enter a name.' })
  name!: string;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  targetDate?: string | null;
}

export class ProjectDto extends MilestoneDto {
  @IsIn(projectStatuses)
  status!: ProjectStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class TaskProjectDto {
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  milestoneId?: string | null;

  @IsOptional()
  @IsBoolean()
  onlyUngrouped?: boolean;
}
```

## modules/workspaces/dto/save-backlog-view.dto.ts

[apps/backend/src/modules/workspaces/dto/save-backlog-view.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/save-backlog-view.dto.ts#L1)

```ts
import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

class BacklogFacetsDto {
  @Matches(/^(?:|unassigned|[0-9a-f-]{36})$/i)
  assignee!: string;

  @IsIn(['', 'None', 'Low', 'Medium', 'High', 'Urgent'])
  priority!: string;

  @IsIn(['', 'Next 7 days', 'Overdue', 'No due date'])
  due!: string;
}

class BacklogViewDto {
  @IsIn(['backlog', 'all', 'review'])
  scope!: 'backlog' | 'all' | 'review';

  @IsIn(['manual', 'priority', 'due'])
  sort!: 'manual' | 'priority' | 'due';

  @IsBoolean()
  mine!: boolean;

  @IsBoolean()
  blocked!: boolean;

  @IsString()
  @MaxLength(200)
  search!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => BacklogFacetsDto)
  facets!: BacklogFacetsDto;
}

export class SaveBacklogViewDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => BacklogViewDto)
  view!: BacklogViewDto;
}
```

## modules/workspaces/dto/update-workspace-kanban-settings.dto.ts

[apps/backend/src/modules/workspaces/dto/update-workspace-kanban-settings.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/update-workspace-kanban-settings.dto.ts#L1)

```ts
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateWorkspaceKanbanSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  activeWipLimit?: number;

  @IsOptional()
  definitionOfReady?: unknown;

  @IsOptional()
  definitionOfDone?: unknown;
}
```

## modules/workspaces/dto/update-workspace.dto.ts

[apps/backend/src/modules/workspaces/dto/update-workspace.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/update-workspace.dto.ts#L1)

```ts
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  reportingTimeZone?: string;
}
```

## modules/workspaces/dto/workspace-invitation-response.dto.ts

[apps/backend/src/modules/workspaces/dto/workspace-invitation-response.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/workspace-invitation-response.dto.ts#L1)

```ts
import { InvitationStatus } from '../../../database/enums/database.enums';

export class WorkspaceInvitationResponseDto {
  id!: string;
  workspaceId!: string;
  invitedById!: string | null;
  invitedUserId!: string | null;
  invitedEmail!: string | null;
  status!: InvitationStatus;
  expiresAt!: Date | null;
  respondedAt!: Date | null;
  createdAt!: Date;
  delivery?: 'sent' | 'link';
  invitePath?: string;
}
```

## modules/workspaces/dto/workspace-kanban-settings-response.dto.ts

[apps/backend/src/modules/workspaces/dto/workspace-kanban-settings-response.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/workspace-kanban-settings-response.dto.ts#L1)

```ts
export class WorkspaceKanbanSettingsResponseDto {
  workspaceId!: string;
  reportingTimeZone?: string;
  activeWipLimit!: number;
  definitionOfReady!: unknown;
  definitionOfDone!: unknown;
  createdAt!: Date;
  updatedAt!: Date;
}
```

## modules/workspaces/dto/workspace-member-response.dto.ts

[apps/backend/src/modules/workspaces/dto/workspace-member-response.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/workspace-member-response.dto.ts#L1)

```ts
export class WorkspaceMemberResponseDto {
  membershipId!: string;
  userId!: string;
  username!: string;
  avatarUrl!: string | null;
  joinedAt!: Date;
  isOwner!: boolean;
}
```

## modules/workspaces/dto/workspace-response.dto.ts

[apps/backend/src/modules/workspaces/dto/workspace-response.dto.ts:1](../../apps/backend/src/modules/workspaces/dto/workspace-response.dto.ts#L1)

```ts
export class WorkspaceResponseDto {
  id!: string;
  ownerId!: string;
  name!: string;
  description!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  archivedAt!: Date | null;
  reportingTimeZone?: string;
}
```

## Inline NotificationPreferenceDto

[apps/backend/src/modules/notifications/controllers/notifications.controller.ts:28](../../apps/backend/src/modules/notifications/controllers/notifications.controller.ts#L28)

```ts
class NotificationPreferenceDto {
  @IsIn(configurableCategories)
  category!: typeof configurableCategories[number];

  @IsBoolean()
  enabled!: boolean;
}
```

## Inline AnalyticsQuery

[apps/backend/src/modules/tasks/controllers/task-analytics.controller.ts:8](../../apps/backend/src/modules/tasks/controllers/task-analytics.controller.ts#L8)

```ts
class AnalyticsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30])
  days = 30;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  day?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  asOf?: string;
}
```
