import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationExtension1756380942990 implements MigrationInterface {
    name = 'OrganizationExtension1756380942990'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "links" jsonb NOT NULL DEFAULT '[]'
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "website" text
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "description" text
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "perks" text array
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "founded" numeric
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "location" text
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "size" text
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "category" text
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" ADD "stage" text
      `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "stage"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "category"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "size"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "location"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "founded"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "perks"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "description"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "website"
      `);
      await queryRunner.query(/* sql */`
        ALTER TABLE "organization" DROP COLUMN "links"
      `);
    }
}
