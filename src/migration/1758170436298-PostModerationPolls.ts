import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostModerationPolls1758170436298 implements MigrationInterface {
  name = 'PostModerationPolls1758170436298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD "pollOptions" jsonb`,
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
