import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_dependencies')
@Unique(
  'uq_task_dependencies_task_depends_on',
  ['taskId', 'dependsOnTaskId'],
)
export class TaskDependency {
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
    name: 'depends_on_task_id',
    type: 'char',
    length: 36,
  })
  dependsOnTaskId!: string;

  @ManyToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'depends_on_task_id',
  })
  dependsOnTask!: Task;

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
