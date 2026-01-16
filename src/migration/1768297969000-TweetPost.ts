import { MigrationInterface, QueryRunner } from 'typeorm';

export class TweetPost1768297969000 implements MigrationInterface {
  name = 'TweetPost1768297969000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetAuthorUsername" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetAuthorName" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetAuthorAvatar" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetAuthorVerified" boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetContent" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetContentHtml" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetMedia" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweetCreatedAt" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "isThread" boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "threadTweets" jsonb`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_post_tweetId" ON "post" ("tweetId") WHERE "tweetId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_tweetId"`);

    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "threadTweets"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "isThread"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetCreatedAt"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetMedia"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetContentHtml"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetContent"`);
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "tweetAuthorVerified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "tweetAuthorAvatar"`,
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetAuthorName"`);
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "tweetAuthorUsername"`,
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweetId"`);
  }
}
