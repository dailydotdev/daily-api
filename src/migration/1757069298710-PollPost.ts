import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollPost1757069298710 implements MigrationInterface {
  name = 'PollPost1757069298710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "poll_option" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "text" text NOT NULL,
        "order" integer NOT NULL,
        "postId" text NOT NULL,
        "numVotes" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_poll_option_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_poll_option_post_id"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_poll_option_post_id_index" ON "poll_option" ("postId") `,
    );

    await queryRunner.query(
      `ALTER TABLE "post" ADD "endsAt" TIMESTAMP DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "numPollVotes" integer DEFAULT '0'`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" ADD "pollVoteOptionId" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" ADD CONSTRAINT "FK_user_post_poll_vote_option_id" FOREIGN KEY ("pollVoteOptionId") REFERENCES "poll_option"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_post" DROP CONSTRAINT "FK_user_post_poll_vote_option_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" DROP COLUMN "pollVoteOptionId"`,
    );

    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "numPollVotes"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "endsAt"`);

    await queryRunner.query(`DROP TABLE "poll_option"`);
  }
}
