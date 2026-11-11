import type { MigrationInterface, QueryRunner } from 'typeorm';
import { legacyDeadlineDate } from '../../modules/tasks/workspace-calendar';

export class AddTaskDueDate1794500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('tasks', 'due_date'))) {
      await queryRunner.query('ALTER TABLE tasks ADD due_date DATE NULL');
    }

    let after = '';
    while (true) {
      const rows: { id: string; legacyUtc: string }[] = await queryRunner.query(
        `SELECT id, DATE_FORMAT(due_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS legacyUtc
         FROM tasks WHERE due_at IS NOT NULL AND due_date IS NULL AND id > ?
         ORDER BY id LIMIT 500`,
        [after],
      );
      if (!rows.length) break;
      for (const row of rows) {
        await queryRunner.query(
          'UPDATE tasks SET due_date = ? WHERE id = ? AND due_date IS NULL',
          [legacyDeadlineDate(row.legacyUtc), row.id],
        );
      }
      after = rows[rows.length - 1].id;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN due_date');
  }
}
