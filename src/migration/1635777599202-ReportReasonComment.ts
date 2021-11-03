import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportReasonComment1635777599202 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" ADD "comment" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" DROP COLUMN "comment"`,
    );
  }
}
