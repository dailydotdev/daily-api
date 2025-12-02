import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationNameUnique1764600895705 implements MigrationInterface {
  name = 'OrganizationNameUnique1764600895705';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_organization_name_unique" ON "organization" ("name") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_name_unique"`,
    );
  }
}
