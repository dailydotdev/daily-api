import { MigrationInterface, QueryRunner } from 'typeorm';
export class PostMentionTracking1683868176744 implements MigrationInterface {
  name = 'PostMentionTracking1683868176744';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_mention" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_mention" REPLICA IDENTITY DEFAULT`,
    );
  }
}
