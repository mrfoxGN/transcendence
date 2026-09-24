import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { Repository } from './repository.entity';
import { User } from '../../users/entities/user.entity';

@Entity('repository_commits')
@Unique('uq_repository_commits_repository_sha', ['repositoryId', 'sha'])
@Index('idx_repository_commits_repository_committed_at', [
  'repositoryId',
  'committedAt',
])
export class RepositoryCommit {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'repository_id',
    type: 'char',
    length: 36,
  })
  repositoryId!: string;

  @ManyToOne(() => Repository, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'repository_id',
  })
  repository!: Repository;

  @Column({
    type: 'varchar',
    length: 64,
  })
  sha!: string;

  @Column({
    type: 'text',
  })
  message!: string;

  @Column({
    name: 'author_github_user_id',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  authorGithubUserId!: string | null;

  @Column({
    name: 'author_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  authorName!: string | null;

  @Column({
    name: 'committer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  committerName!: string | null;

  @Column({
    name: 'matched_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  matchedUserId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'matched_user_id',
  })
  matchedUser!: User | null;

  @Column({
    name: 'committed_at',
    type: 'datetime',
    precision: 6,
  })
  committedAt!: Date;

  @Column({
    name: 'github_url',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  githubUrl!: string | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;
}
