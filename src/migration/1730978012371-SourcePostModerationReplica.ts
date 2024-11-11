import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcePostModerationReplica1730978012371
  implements MigrationInterface
{
  name = 'SourcePostModerationReplica1730978012371';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_post_moderation" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_post_moderation" REPLICA IDENTITY DEFAULT`,
    );
  }
}
