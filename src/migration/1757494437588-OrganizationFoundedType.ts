import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationFoundedType1757494437588 implements MigrationInterface {
  name = 'OrganizationFoundedType1757494437588'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "founded"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "founded" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "founded"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "founded" numeric
    `);
  }
}
