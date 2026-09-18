import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import {
  TaskPriority,
  TaskStatus,
} from '../enums/database.enums';

import { User } from './user.entity';
import { Workspace } from './workspace.entity';

@Entity('tasks')
@Index(
  'idx_tasks_workspace_status_position',
  ['workspaceId', 'status', 'position'],
)
@Index(
  'idx_tasks_workspace_priority',
  ['workspaceId', 'priority'],
)
@Index(
  'idx_tasks_due_at',
  ['dueAt'],
)
export class Task {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'char',
    length: 36,
  })
  workspaceId!: string;

  @ManyToOne(() => Workspace, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspace_id',
  })
  workspace!: Workspace;

  @Column({
    name: 'creator_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  creatorId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'creator_id',
  })
  creator!: User | null;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    name: 'acceptance_criteria',
    type: 'text',
    nullable: true,
  })
  acceptanceCriteria!: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
  })
  status!: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    nullable: true,
  })
  priority!: TaskPriority | null;

  @Column({
    type: 'int',
    default: 0,
  })
  position!: number;

  @Column({
    name: 'is_blocked',
    type: 'boolean',
    default: false,
  })
  isBlocked!: boolean;

  @Column({
    name: 'blocked_reason',
    type: 'text',
    nullable: true,
  })
  blockedReason!: string | null;

  @Column({
    name: 'blocked_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  blockedAt!: Date | null;

  @Column({
    name: 'due_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  dueAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
  })
  updatedAt!: Date;

  @Column({
    name: 'completed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  completedAt!: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  cancelledAt!: Date | null;

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}
