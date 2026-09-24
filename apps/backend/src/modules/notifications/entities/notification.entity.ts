import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity('notifications')
@Index('idx_notifications_user_read_created_at', [
  'userId',
  'readAt',
  'createdAt',
])
export class Notification {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'user_id',
    type: 'char',
    length: 36,
  })
  userId!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'workspace_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  workspaceId!: string | null;

  @ManyToOne(() => Workspace, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'workspace_id',
  })
  workspace!: Workspace | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  type!: string;

  @Column({
    type: 'varchar',
    length: 1000,
  })
  message!: string;

  @Column({
    name: 'related_resource_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  relatedResourceType!: string | null;

  @Column({
    name: 'related_resource_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  relatedResourceId!: string | null;

  @Column({
    type: 'json',
    nullable: true,
  })
  payload!: unknown | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    name: 'read_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  readAt!: Date | null;
}
