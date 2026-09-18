import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_comments')
@Index(
  'idx_task_comments_task_created_at',
  ['taskId', 'createdAt'],
)
export class TaskComment {
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
    name: 'author_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  authorId!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'author_id',
  })
  author!: User | null;

  @Column({
    type: 'text',
  })
  content!: string;

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
    name: 'edited_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  editedAt!: Date | null;

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}
