import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentReportReplica1688567430880 implements MigrationInterface {
  name = 'CommentReportReplica1688567430880';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment_report" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment_report" REPLICA IDENTITY DEFAULT`,
    );
  }
}
