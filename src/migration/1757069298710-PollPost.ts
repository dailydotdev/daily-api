import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollPost1757069298710 implements MigrationInterface {
  name = 'PollPost1757069298710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "poll_option" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "order" integer NOT NULL, "postId" text NOT NULL, "numVotes" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_5fdd46d449ddcc8201aed9b5a1b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "poll_option_post_id_index" ON "poll_option" ("postId") `,
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
      `ALTER TABLE "poll_option" ADD CONSTRAINT "FK_c4b452b62ed9d5dc60f671e4b1b" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_post" ADD CONSTRAINT "FK_d7809c10257f37f8dbca3b06bef" FOREIGN KEY ("pollVoteOptionId") REFERENCES "poll_option"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_post" DROP CONSTRAINT "FK_d7809c10257f37f8dbca3b06bef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "poll_option" DROP CONSTRAINT "FK_c4b452b62ed9d5dc60f671e4b1b"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" DROP COLUMN "pollVoteOptionId"`,
    );

    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "numPollVotes"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "endsAt"`);

    await queryRunner.query(`DROP INDEX "public"."poll_option_post_id_index"`);
    await queryRunner.query(`DROP TABLE "poll_option"`);
  }
}
