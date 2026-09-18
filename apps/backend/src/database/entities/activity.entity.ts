import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from './user.entity';
import { Workspace } from './workspace.entity';

@Entity('activities')
@Index(
  'idx_activities_workspace_created_at',
  ['workspaceId', 'createdAt'],
)
export class Activity {
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
    name: 'actor_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  actorUserId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'actor_user_id',
  })
  actorUser!: User | null;

  @Column({
    name: 'action_type',
    type: 'varchar',
    length: 100,
  })
  actionType!: string;

  @Column({
    name: 'resource_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  resourceType!: string | null;

  @Column({
    name: 'resource_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  resourceId!: string | null;

  @Column({
    type: 'json',
    nullable: true,
  })
  metadata!: unknown | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;
}
