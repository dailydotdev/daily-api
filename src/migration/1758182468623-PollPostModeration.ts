import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollPostModeration1758182468623 implements MigrationInterface {
  name = 'PollPostModeration1758182468623';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD "pollOptions" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD "duration" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP COLUMN "duration"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP COLUMN "pollOptions"`,
    );
  }
}
