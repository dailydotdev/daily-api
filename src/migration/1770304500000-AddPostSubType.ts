import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostSubType1770304500000 implements MigrationInterface {
  name = 'AddPostSubType1770304500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "subType" text`);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_subType" ON "post" ("subType") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_subType"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "subType"`);
  }
}
