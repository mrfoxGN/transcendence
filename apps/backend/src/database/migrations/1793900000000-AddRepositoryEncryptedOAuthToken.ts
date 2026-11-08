import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepositoryEncryptedOAuthToken1793900000000 implements MigrationInterface {
  name = 'AddRepositoryEncryptedOAuthToken1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `repositories` ' + 'ADD `encrypted_oauth_token` text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `repositories` ' + 'DROP COLUMN `encrypted_oauth_token`',
    );
  }
}
