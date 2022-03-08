import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActiveView1645627361402 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE VIEW "public"."active_view" AS SELECT "view"."postId" AS "postId", "view"."userId" AS "userId", "view"."timestamp" AS "timestamp", "view"."hidden" AS "hidden" FROM "public"."view" LEFT JOIN "public"."post" "post" ON "post"."id" = "view"."postId" WHERE "post"."deleted" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "public"."active_view"`);
  }
}
