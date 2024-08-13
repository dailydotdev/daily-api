import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReadingStreakActions1723562465540 implements MigrationInterface {
  name = 'ReadingStreakActions1723562465540';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reading_streak_actions" ("id" text NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" text NOT NULL, "userStreakUserId" character varying(36), CONSTRAINT "PK_bb114c7c63fde1e764480b693ec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" ADD CONSTRAINT "FK_f9fdcfffdde9bbb9fe59d40b56b" FOREIGN KEY ("userStreakUserId") REFERENCES "user_streak"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" DROP CONSTRAINT "FK_f9fdcfffdde9bbb9fe59d40b56b"`,
    );
    await queryRunner.query(`DROP TABLE "reading_streak_actions"`);
  }
}
