import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalytics1754664628189 implements MigrationInterface {
  name = 'PostAnalytics1754664628189';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_analytics" ("id" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "impressions" integer NOT NULL DEFAULT '0', "reach" integer NOT NULL DEFAULT '0', "bookmarks" integer NOT NULL DEFAULT '0', "profileViews" integer NOT NULL DEFAULT '0', "followers" integer NOT NULL DEFAULT '0', "squadJoins" integer NOT NULL DEFAULT '0', "sharesExternal" integer NOT NULL DEFAULT '0', "sharesInternal" integer NOT NULL DEFAULT '0', "reputation" integer NOT NULL DEFAULT '0', "coresEarned" integer NOT NULL DEFAULT '0', "upvotes" integer NOT NULL DEFAULT '0', "downvotes" integer NOT NULL DEFAULT '0', "comments" integer NOT NULL DEFAULT '0', "awards" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_421771f55c623cd4f6103828196" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_analytics"`);
  }
}
