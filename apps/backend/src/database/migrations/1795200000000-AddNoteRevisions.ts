import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoteRevisions1795200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE notes ADD revision INT UNSIGNED NOT NULL DEFAULT 1, ADD pinned_at DATETIME(6) NULL');
    await queryRunner.query(`CREATE TABLE note_revisions (
      note_id CHAR(36) NOT NULL,
      revision INT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      content LONGTEXT NULL,
      saved_at DATETIME(6) NOT NULL,
      PRIMARY KEY (note_id, revision),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE note_revisions');
    await queryRunner.query('ALTER TABLE notes DROP COLUMN revision, DROP COLUMN pinned_at');
  }
}
