import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeletedPost1737718327973 implements MigrationInterface {
  name = 'DeletedPost1737718327973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."post" ("id", "sourceId", "deleted", "shortId", "showOnFeed", "flags") VALUES ('404', 'unknown', true, '404', false, '{"visible": true, "showOnFeed": false, "sentAnalyticsReport": false}');`,
    );
    await queryRunner.query(
      `CREATE RULE prototect_ghostpost_deletion AS ON DELETE TO "post" WHERE old.id IN ('404') DO INSTEAD nothing;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "public"."user" where id = "404"`);
    await queryRunner.query(
      `DROP RULE prototect_ghostpost_deletion on "post";`,
    );
  }
}
