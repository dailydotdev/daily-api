import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedSentimentTable1771326220000 implements MigrationInterface {
  name = "AddFeedSentimentTable1771326220000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "feed_sentiment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying(36) NOT NULL,
        "sentiment" character varying(20) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_sentiment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feed_sentiment_user"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_feed_sentiment_user_id"
        ON "feed_sentiment" ("userId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_feed_sentiment_sentiment"
        ON "feed_sentiment" ("sentiment")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_feed_sentiment_created_at"
        ON "feed_sentiment" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "feed_sentiment"
    `);
  }
}
