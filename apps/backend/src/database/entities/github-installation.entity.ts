import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import {
  GitHubAccountType,
  GitHubInstallationStatus,
} from '../enums/database.enums';

import { User } from './user.entity';

@Entity('github_installations')
export class GitHubInstallation {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'github_installation_id',
    type: 'varchar',
    length: 32,
    unique: true,
  })
  githubInstallationId!: string;

  @Column({
    name: 'connected_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  connectedById!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'connected_by_id',
  })
  connectedBy!: User | null;

  @Column({
    name: 'target_github_id',
    type: 'varchar',
    length: 32,
  })
  targetGithubId!: string;

  @Column({
    name: 'target_login',
    type: 'varchar',
    length: 255,
  })
  targetLogin!: string;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: GitHubAccountType,
  })
  targetType!: GitHubAccountType;

  @Column({
    type: 'enum',
    enum: GitHubInstallationStatus,
  })
  status!: GitHubInstallationStatus;

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
