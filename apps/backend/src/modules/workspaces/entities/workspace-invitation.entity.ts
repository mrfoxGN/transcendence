import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { InvitationStatus } from '../../../database/enums/database.enums';
import { User } from '../../users/entities/user.entity';
import { Workspace } from './workspace.entity';

@Entity('workspace_invitations')
export class WorkspaceInvitation {
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
    name: 'invited_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  invitedById!: string | null;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'invited_by_id',
  })
  invitedBy!: User | null;

  @Column({
    name: 'invited_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  invitedUserId!: string | null;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'invited_user_id',
  })
  invitedUser!: User | null;

  @Column({
    name: 'invited_email',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  invitedEmail!: string | null;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
  })
  status!: InvitationStatus;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  tokenHash!: string | null;

  @Column({
    name: 'expires_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  expiresAt!: Date | null;

  @Column({
    name: 'responded_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  respondedAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;
}
