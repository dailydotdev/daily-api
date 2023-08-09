import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchRecommendation1691591099936 implements MigrationInterface {
  name = 'SearchRecommendation1691591099936';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "search_recommendation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "postId" text NOT NULL, "question" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_07014f6e9062efbf6b202a63c48" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e93e34c0c3135cba8cade921ad" ON "search_recommendation" ("postId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "search_recommendation" ADD CONSTRAINT "FK_e93e34c0c3135cba8cade921ad0" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "search_recommendation" DROP CONSTRAINT "FK_e93e34c0c3135cba8cade921ad0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e93e34c0c3135cba8cade921ad"`,
    );
    await queryRunner.query(`DROP TABLE "search_recommendation"`);
  }
}
