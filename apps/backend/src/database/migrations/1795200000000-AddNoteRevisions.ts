import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoteRevisions1795200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE notes ADD pinned_at DATETIME(6) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE notes DROP COLUMN pinned_at');
  }
}
