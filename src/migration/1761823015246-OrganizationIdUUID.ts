import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationIdUUID1761823015246 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_content_preference_organization_id"`);
    await queryRunner.query(`ALTER TABLE "opportunity" DROP CONSTRAINT "FK_opportunity_organization_id"`);
    await queryRunner.query(`ALTER TABLE "organization" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`);
    await queryRunner.query(`ALTER TABLE "opportunity" ALTER COLUMN "organizationId" TYPE uuid USING "organizationId"::uuid`);
    await queryRunner.query(`ALTER TABLE "content_preference" ALTER COLUMN "organizationId" TYPE uuid USING "organizationId"::uuid`);
    await queryRunner.query(`ALTER TABLE "opportunity" ADD CONSTRAINT "FK_opportunity_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_content_preference_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_content_preference_organization_id"`);
    await queryRunner.query(`ALTER TABLE "opportunity" DROP CONSTRAINT "FK_opportunity_organization_id"`);
    await queryRunner.query(`ALTER TABLE "organization" ALTER COLUMN "id" TYPE text USING "id"::text`);
    await queryRunner.query(`ALTER TABLE "opportunity" ALTER COLUMN "organizationId" TYPE text USING "organizationId"::text`);
    await queryRunner.query(`ALTER TABLE "content_preference" ALTER COLUMN "organizationId" TYPE text USING "organizationId"::text`);
    await queryRunner.query(`ALTER TABLE "opportunity" ADD CONSTRAINT "FK_opportunity_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_content_preference_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }
}
