import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { RepositoryEntryType } from '../../../database/enums/database.enums';

import { Repository } from './repository.entity';

@Entity('repository_entries')
@Unique('uq_repository_entries_repository_branch_path_hash', [
  'repositoryId',
  'branchName',
  'pathHash',
])
export class RepositoryEntry {
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
    name: 'branch_name',
    type: 'varchar',
    length: 255,
  })
  branchName!: string;

  @Column({
    type: 'varchar',
    length: 2048,
  })
  path!: string;

  @Column({
    name: 'path_hash',
    type: 'char',
    length: 64,
  })
  pathHash!: string;

  @Column({
    name: 'parent_path',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  parentPath!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name!: string;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: RepositoryEntryType,
  })
  entryType!: RepositoryEntryType;

  @Column({
    name: 'object_sha',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  objectSha!: string | null;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    nullable: true,
  })
  sizeBytes!: string | null;

  @Column({
    name: 'last_synced_at',
    type: 'datetime',
    precision: 6,
  })
  lastSyncedAt!: Date;
}
