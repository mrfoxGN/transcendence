import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { TaskRepositoryLinkType } from '../enums/database.enums';

import { Repository } from './repository.entity';
import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_repository_links')
export class TaskRepositoryLink {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'task_id',
    type: 'char',
    length: 36,
  })
  taskId!: string;

  @ManyToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
  })
  task!: Task;

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
    name: 'link_type',
    type: 'enum',
    enum: TaskRepositoryLinkType,
  })
  linkType!: TaskRepositoryLinkType;

  @Column({
    name: 'branch_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  branchName!: string | null;

  @Column({
    name: 'file_path',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  filePath!: string | null;

  @Column({
    name: 'commit_sha',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  commitSha!: string | null;

  @Column({
    name: 'created_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  createdById!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'created_by_id',
  })
  createdBy!: User | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;
}
