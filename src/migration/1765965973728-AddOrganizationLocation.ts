import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationLocation1765965973728
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ADD COLUMN "locationId" uuid NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_organization_locationId" ON "organization" ("locationId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "organization"
       ADD CONSTRAINT "FK_organization_dataset_location_locationId"
       FOREIGN KEY ("locationId")
       REFERENCES "dataset_location"("id")
       ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "organization" DROP COLUMN "location"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ADD COLUMN "location" text DEFAULT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "organization" DROP CONSTRAINT "FK_organization_dataset_location_locationId"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_organization_locationId"`);

    await queryRunner.query(
      `ALTER TABLE "organization" DROP COLUMN "locationId"`,
    );
  }
}
