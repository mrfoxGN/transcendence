import { Column, Entity, PrimaryColumn } from 'typeorm';

import { AppRole, UserStatus } from '../../../database/enums/database.enums';

@Entity('users')
export class User {
  @Column({ type: 'enum', enum: ['system', 'light', 'dark'], default: 'system' })
  theme?: 'system' | 'light' | 'dark';

  @Column({ name: 'notification_badge', type: 'boolean', default: true })
  notificationBadge?: boolean;
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

  @Column({ name: 'verified_email', type: 'varchar', length: 320, nullable: true })
  verifiedEmail?: string | null;

  @Column({ name: 'email_verify_digest', type: 'char', length: 64, nullable: true })
  emailVerifyDigest?: string | null;

  @Column({ name: 'email_verify_expires_at', type: 'datetime', precision: 6, nullable: true })
  emailVerifyExpiresAt?: Date | null;

  @Column({ name: 'password_reset_digest', type: 'char', length: 64, nullable: true })
  passwordResetDigest?: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'datetime', precision: 6, nullable: true })
  passwordResetExpiresAt?: Date | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
  })
  passwordHash!: string;

  @Column({
    name: 'avatar_url',
    type: 'text',
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
    name: 'token_version',
    type: 'int',
    default: 0,
  })
  tokenVersion!: number;

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
