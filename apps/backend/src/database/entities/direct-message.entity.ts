import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { DirectConversation } from './direct-conversation.entity';
import { User } from './user.entity';

@Entity('direct_messages')
@Index('idx_direct_messages_conversation_created_at', [
  'conversationId',
  'createdAt',
])
export class DirectMessage {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'conversation_id',
    type: 'char',
    length: 36,
  })
  conversationId!: string;

  @ManyToOne(() => DirectConversation, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
  })
  conversation!: DirectConversation;

  @Column({
    name: 'sender_id',
    type: 'char',
    length: 36,
  })
  senderId!: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'sender_id',
  })
  sender!: User;

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
