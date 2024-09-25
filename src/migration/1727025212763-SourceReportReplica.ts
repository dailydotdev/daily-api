import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceReportReplica1727025212763 implements MigrationInterface {
  name = 'SourceReportReplica1727025212763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_report" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_report" REPLICA IDENTITY DEFAULT`,
    );
  }
}
