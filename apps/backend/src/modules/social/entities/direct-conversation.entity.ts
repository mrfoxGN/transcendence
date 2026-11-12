import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity('direct_conversations')
@Unique('uq_direct_conversations_user_pair', ['userAId', 'userBId'])
@Index('idx_direct_conversations_last_message_at', ['lastMessageAt'])
export class DirectConversation {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'user_a_id',
    type: 'char',
    length: 36,
  })
  userAId!: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_a_id',
  })
  userA!: User;

  @Column({
    name: 'user_b_id',
    type: 'char',
    length: 36,
  })
  userBId!: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_b_id',
  })
  userB!: User;

  @Column({
    name: 'user_a_last_read_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  userALastReadAt!: Date | null;

  @Column({
    name: 'user_b_last_read_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  userBLastReadAt!: Date | null;

  @Column({
    name: 'last_message_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  lastMessageAt!: Date | null;

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
}
