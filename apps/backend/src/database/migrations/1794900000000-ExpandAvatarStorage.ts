import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandAvatarStorage1794900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users MODIFY avatar_url TEXT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE users SET avatar_url = NULL WHERE CHAR_LENGTH(avatar_url) > 500');
    await queryRunner.query('ALTER TABLE users MODIFY avatar_url VARCHAR(500) NULL');
  }
}
