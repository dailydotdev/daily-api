import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakEntity1705996376430 implements MigrationInterface {
  name = 'UserStreakEntity1705996376430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_streak" ("userId" text NOT NULL, "currentStreak" integer NOT NULL DEFAULT '0', "totalStreak" integer NOT NULL DEFAULT '0', "maxStreak" integer NOT NULL DEFAULT '0', "lastViewAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d8ec0aea914605bd0455034673" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d8ec0aea914605bd045503467" ON "user_streak" ("userId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d8ec0aea914605bd045503467"`,
    );
    await queryRunner.query(`DROP TABLE "user_streak"`);
  }
}
