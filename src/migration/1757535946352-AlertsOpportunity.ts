import { MigrationInterface, QueryRunner } from "typeorm";

export class AlertsOpportunity1757535946352 implements MigrationInterface {
    name = 'AlertsOpportunity1757535946352'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(/* sql */`
        ALTER TABLE "alerts" ADD "opportunityId" uuid
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "alerts"
          ADD CONSTRAINT "FK_alerts_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      `);
      await queryRunner.query(/* sql */`
        CREATE INDEX IF NOT EXISTS "IDX_alerts_opportunity_id" ON "alerts" ("opportunityId")
      `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(/* sql */`
        ALTER TABLE "alerts" DROP COLUMN "opportunityId"
      `);
    }
}
