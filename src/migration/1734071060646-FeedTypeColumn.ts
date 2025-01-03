import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedTypeColumn1734071060646 implements MigrationInterface {
  name = 'FeedTypeColumn1734071060646'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed" ADD "type" text GENERATED ALWAYS AS (CASE WHEN "id" = "userId" THEN 'main' ELSE 'custom' END) STORED NOT NULL`);
    await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["api","public","feed","GENERATED_COLUMN","type","CASE WHEN \"id\" = \"userId\" THEN 'main' ELSE 'custom' END"]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","type","api","public","feed"]);
    await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "type"`);
  }
}
