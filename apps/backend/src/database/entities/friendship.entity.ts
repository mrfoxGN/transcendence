import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { FriendshipStatus } from '../enums/database.enums';
import { User } from './user.entity';

@Entity('friendships')
@Unique('uq_friendships_user_pair', ['userAId', 'userBId'])
export class Friendship {
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
    name: 'requested_by_id',
    type: 'char',
    length: 36,
  })
  requestedById!: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'requested_by_id',
  })
  requestedBy!: User;

  @Column({
    type: 'enum',
    enum: FriendshipStatus,
  })
  status!: FriendshipStatus;

  @Column({
    name: 'requested_at',
    type: 'datetime',
    precision: 6,
  })
  requestedAt!: Date;

  @Column({
    name: 'responded_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  respondedAt!: Date | null;
}
