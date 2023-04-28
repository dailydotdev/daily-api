import { MigrationInterface, QueryRunner } from 'typeorm';

export class FreeformPost1682497694917 implements MigrationInterface {
  name = 'FreeformPost1682497694917';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "content" text`);
    await queryRunner.query(`ALTER TABLE "post" ADD "contentHtml" text`);
    await queryRunner.query(
      `CREATE OR REPLACE VIEW "active_post" AS SELECT p.* FROM "public"."post" "p" WHERE "p"."deleted" = false AND "p"."visible" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentHtml"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "content"`);
  }
}
