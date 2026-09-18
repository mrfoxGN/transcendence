import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('github_accounts')
export class GitHubAccount {
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

  @OneToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'github_user_id',
    type: 'varchar',
    length: 32,
    unique: true,
  })
  githubUserId!: string;

  @Column({
    name: 'github_login',
    type: 'varchar',
    length: 255,
  })
  githubLogin!: string;

  @Column({
    name: 'avatar_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatarUrl!: string | null;

  @Column({
    name: 'profile_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  profileUrl!: string | null;

  @Column({
    name: 'connected_at',
    type: 'datetime',
    precision: 6,
  })
  connectedAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
  })
  updatedAt!: Date;
}
