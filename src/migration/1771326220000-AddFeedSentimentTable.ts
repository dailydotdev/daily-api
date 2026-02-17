import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedSentimentTable1771326220000
  implements MigrationInterface
{
  name = 'AddFeedSentimentTable1771326220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "feed_sentiment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying(36) NOT NULL,
        "sentiment" character varying(20) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_sentiment" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feed_sentiment_user_id" ON "feed_sentiment" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feed_sentiment_sentiment" ON "feed_sentiment" ("sentiment")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feed_sentiment_created_at" ON "feed_sentiment" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "feed_sentiment" 
       ADD CONSTRAINT "FK_feed_sentiment_user" 
       FOREIGN KEY ("userId") 
       REFERENCES "user"("id") 
       ON DELETE CASCADE 
       ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feed_sentiment" DROP CONSTRAINT "FK_feed_sentiment_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_feed_sentiment_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_sentiment_sentiment"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_sentiment_user_id"`);
    await queryRunner.query(`DROP TABLE "feed_sentiment"`);
  }
}
