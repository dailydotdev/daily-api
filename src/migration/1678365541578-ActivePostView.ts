import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivePostView1678365541578 implements MigrationInterface {
  name = 'ActivePostView1678365541578';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE VIEW "active_post" AS SELECT p.* FROM "public"."post" "p" WHERE "p"."deleted" = false AND "p"."visible" = true`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'active_post',
        'SELECT p.* FROM "public"."post" "p" WHERE "p"."deleted" = false AND "p"."visible" = true',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'active_post', 'public'],
    );
    await queryRunner.query(`DROP VIEW "active_post"`);
  }
}
