import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskStatusTodo1795600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tasks MODIFY status enum('BACKLOG', 'TODO', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE task_status_history MODIFY from_status enum('BACKLOG', 'TODO', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE task_status_history MODIFY to_status enum('BACKLOG', 'TODO', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE tasks SET status = 'BACKLOG' WHERE status = 'TODO'`,
    );
    await queryRunner.query(
      `UPDATE task_status_history SET from_status = 'BACKLOG' WHERE from_status = 'TODO'`,
    );
    await queryRunner.query(
      `UPDATE task_status_history SET to_status = 'BACKLOG' WHERE to_status = 'TODO'`,
    );
    await queryRunner.query(
      `ALTER TABLE tasks MODIFY status enum('BACKLOG', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE task_status_history MODIFY from_status enum('BACKLOG', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE task_status_history MODIFY to_status enum('BACKLOG', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL`,
    );
  }
}
