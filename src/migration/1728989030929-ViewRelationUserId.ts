import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewRelationUserId1728989030929 implements MigrationInterface {
  name = 'ViewRelationUserId1728989030929';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'active_view', 'public'],
    );
    await queryRunner.query(`DROP VIEW "active_view"`);
    await queryRunner.query(
      `ALTER TABLE "public"."view" ALTER COLUMN "userId" TYPE character varying(36)`,
    );
    await queryRunner.query(
      `CREATE VIEW "active_view" AS SELECT view.* FROM "public"."view" "view" LEFT JOIN "public"."post" "post" ON "post"."id" = "view"."postId" WHERE "post"."deleted" = false`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'active_view',
        'SELECT view.* FROM "public"."view" "view" LEFT JOIN "public"."post" "post" ON "post"."id" = "view"."postId" WHERE "post"."deleted" = false',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'active_view', 'public'],
    );
    await queryRunner.query(`DROP VIEW "active_view"`);
    await queryRunner.query(
      `ALTER TABLE "public"."view" ALTER COLUMN "userId" TYPE character varying`,
    );
    await queryRunner.query(
      `CREATE VIEW "active_view" AS SELECT view.* FROM "public"."view" "view" LEFT JOIN "public"."post" "post" ON "post"."id" = "view"."postId" WHERE "post"."deleted" = false`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'active_view',
        'SELECT view.* FROM "public"."view" "view" LEFT JOIN "public"."post" "post" ON "post"."id" = "view"."postId" WHERE "post"."deleted" = false',
      ],
    );
  }
}
