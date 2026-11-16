import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBoardColumns1794300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE workspace_kanban_settings ADD board_columns JSON NULL');
    await queryRunner.query('ALTER TABLE tasks ADD board_column_id VARCHAR(40) NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN board_column_id');
    await queryRunner.query('ALTER TABLE workspace_kanban_settings DROP COLUMN board_columns');
  }
}
