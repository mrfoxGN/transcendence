import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity('workspace_files')
export class WorkspaceFile {
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
    name: 'uploader_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  uploaderId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'uploader_id',
  })
  uploader!: User | null;

  @Column({
    name: 'task_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  taskId!: string | null;

  @ManyToOne(() => Task, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'task_id',
  })
  task!: Task | null;

  @Column({
    name: 'original_name',
    type: 'varchar',
    length: 255,
  })
  originalName!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
  })
  displayName!: string;

  @Column({
    name: 'storage_key',
    type: 'varchar',
    length: 512,
    unique: true,
  })
  storageKey!: string;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  mimeType!: string | null;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
  })
  sizeBytes!: string;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}
