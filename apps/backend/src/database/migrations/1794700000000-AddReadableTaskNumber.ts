import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReadableTaskNumber1794700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD task_number INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ADD UNIQUE INDEX uq_tasks_task_number (task_number)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN task_number');
  }
}
