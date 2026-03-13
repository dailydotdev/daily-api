import { MigrationInterface, QueryRunner } from 'typeorm';

export class PopularGearView1772100100000 implements MigrationInterface {
  name = 'PopularGearView1772100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW "popular_gear" AS
      SELECT
        ug."gearId"        AS "gearId",
        dg."name"          AS "name",
        dg."category"      AS "category",
        COUNT(DISTINCT ug."userId") AS "userCount"
      FROM "user_gear" ug
      INNER JOIN "dataset_gear" dg
        ON dg."id" = ug."gearId"
      WHERE dg."category" IS NOT NULL
      GROUP BY ug."gearId", dg."name", dg."category"
      HAVING COUNT(DISTINCT ug."userId") >= 1
      ORDER BY COUNT(DISTINCT ug."userId") DESC
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_popular_gear_gear_id"
        ON "popular_gear" ("gearId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_popular_gear_category"
        ON "popular_gear" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_gear"`);
  }
}
