import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTokenVersion1793491200000 implements MigrationInterface {
  name = 'AddUserTokenVersion1793491200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `token_version` int NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `token_version`');
  }
}
