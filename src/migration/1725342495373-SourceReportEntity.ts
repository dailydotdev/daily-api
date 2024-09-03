import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceReportEntity1725342495373 implements MigrationInterface {
  name = 'SourceReportEntity1725342495373';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_report" ("sourceId" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reason" text NOT NULL, "comment" text, CONSTRAINT "PK_26f65a4bcb76155e74a18fcd291" PRIMARY KEY ("sourceId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_report_source_id" ON "source_report" ("sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_report_user_id" ON "source_report" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "source_report" ADD CONSTRAINT "FK_85728503871528f18bba6f3c579" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_report" DROP CONSTRAINT "FK_85728503871528f18bba6f3c579"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_source_report_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_report_source_id"`,
    );
    await queryRunner.query(`DROP TABLE "source_report"`);
  }
}
