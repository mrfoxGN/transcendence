import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { RepositoryVisibility } from '../../../database/enums/database.enums';

import { GitHubInstallation } from './github-installation.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity('repositories')
@Unique('uq_repositories_workspace_github_repository', [
  'workspaceId',
  'githubRepositoryId',
])
export class Repository {
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
    name: 'installation_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  installationId!: string | null;

  @ManyToOne(() => GitHubInstallation, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'installation_id',
  })
  installation!: GitHubInstallation | null;

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
    name: 'github_repository_id',
    type: 'varchar',
    length: 32,
  })
  githubRepositoryId!: string;

  @Column({
    name: 'owner_login',
    type: 'varchar',
    length: 255,
  })
  ownerLogin!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name!: string;

  @Column({
    name: 'full_name',
    type: 'varchar',
    length: 512,
  })
  fullName!: string;

  @Column({
    name: 'repository_url',
    type: 'varchar',
    length: 1000,
  })
  repositoryUrl!: string;

  @Column({
    name: 'default_branch',
    type: 'varchar',
    length: 255,
  })
  defaultBranch!: string;

  @Column({
    type: 'enum',
    enum: RepositoryVisibility,
  })
  visibility!: RepositoryVisibility;

  @Column({
    name: 'last_synced_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  lastSyncedAt!: Date | null;

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
    name: 'disconnected_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  disconnectedAt!: Date | null;
}
