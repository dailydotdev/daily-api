import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedTypeColumn1734071060646 implements MigrationInterface {
  name = 'FeedTypeColumn1734071060646'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed" ADD "type" text GENERATED ALWAYS AS (CASE WHEN "id" = "userId" THEN 'main' ELSE 'custom' END) STORED NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "type"`);
  }
}
