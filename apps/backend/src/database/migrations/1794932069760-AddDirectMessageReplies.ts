import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageReplies1794932069760
  implements MigrationInterface
{
  name = 'AddDirectMessageReplies1794932069760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `direct_messages` ADD `reply_to_id` char(36) NULL',
    );

    await queryRunner.query(
      `ALTER TABLE \`direct_messages\`
       ADD CONSTRAINT \`FK_direct_messages_reply_to\`
       FOREIGN KEY (\`reply_to_id\`)
       REFERENCES \`direct_messages\`(\`id\`)
       ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `direct_messages` DROP FOREIGN KEY `FK_direct_messages_reply_to`',
    );

    await queryRunner.query(
      'ALTER TABLE `direct_messages` DROP COLUMN `reply_to_id`',
    );
  }
}