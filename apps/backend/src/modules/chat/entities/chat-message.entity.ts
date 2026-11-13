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

@Entity('chat_messages')
@Index('idx_chat_messages_workspace_created_at', ['workspaceId', 'createdAt'])
export class ChatMessage {
  @Column({ name: 'reply_to_id', type: 'char', length: 36, nullable: true })
  replyToId?: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', length: 255, nullable: true })
  attachmentName?: string | null;

  @Column({ name: 'attachment_data', type: 'mediumblob', nullable: true, select: false })
  attachmentData?: Buffer | null;

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
    name: 'sender_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  senderId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'sender_id',
  })
  sender!: User | null;

  @Column({
    type: 'text',
  })
  content!: string;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    name: 'edited_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  editedAt!: Date | null;

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}
