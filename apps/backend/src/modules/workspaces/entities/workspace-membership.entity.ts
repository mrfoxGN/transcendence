import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import type { SaveBacklogViewDto } from '../dto/save-backlog-view.dto';
import { Workspace } from './workspace.entity';

@Entity('workspace_memberships')
@Unique('uq_workspace_memberships_workspace_user', ['workspaceId', 'userId'])
export class WorkspaceMembership {
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
    name: 'joined_at',
    type: 'datetime',
    precision: 6,
  })
  joinedAt!: Date;

  @Column({ name: 'chat_read_at', type: 'datetime', precision: 6, nullable: true })
  chatReadAt!: Date | null;

  @Column({ name: 'chat_read_message_id', type: 'char', length: 36, nullable: true })
  chatReadMessageId!: string | null;

  @Column({ name: 'backlog_views', type: 'json', nullable: true })
  backlogViews!: SaveBacklogViewDto[] | null;
}
