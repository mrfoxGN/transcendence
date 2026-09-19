import {
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm';

import {
  AppRole,
  UserStatus,
} from '../../../database/enums/database.enums';

@Entity('users')
export class User {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  username!: string;

  @Column({
    type: 'varchar',
    length: 320,
    unique: true,
  })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
  })
  passwordHash!: string;

  @Column({
    name: 'avatar_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatarUrl!: string | null;

  @Column({
    name: 'app_role',
    type: 'enum',
    enum: AppRole,
  })
  appRole!: AppRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
  })
  status!: UserStatus;

  @Column({
    name: 'last_seen_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  lastSeenAt!: Date | null;

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

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}
