import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { TaskStatus } from '../enums/database.enums';

import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_status_history')
@Index(
  'idx_task_status_history_task_changed_at',
  ['taskId', 'changedAt'],
)
export class TaskStatusHistory {
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
    name: 'from_status',
    type: 'enum',
    enum: TaskStatus,
    nullable: true,
  })
  fromStatus!: TaskStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: TaskStatus,
  })
  toStatus!: TaskStatus;

  @Column({
    name: 'changed_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  changedById!: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'changed_by_id',
  })
  changedBy!: User | null;

  @Column({
    name: 'changed_at',
    type: 'datetime',
    precision: 6,
  })
  changedAt!: Date;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  note!: string | null;
}
