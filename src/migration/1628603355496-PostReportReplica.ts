import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostReportReplica1628603355496 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" REPLICA IDENTITY DEFAULT`,
    );
  }
}
