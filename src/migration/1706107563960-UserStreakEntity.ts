import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakEntity1706107563960 implements MigrationInterface {
  name = 'UserStreakEntity1706107563960';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_streak" ("userId" character varying(36) NOT NULL, "currentStreak" integer NOT NULL DEFAULT '0', "totalStreak" integer NOT NULL DEFAULT '0', "maxStreak" integer NOT NULL DEFAULT '0', "lastViewAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d8ec0aea914605bd0455034673" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak" ADD CONSTRAINT "FK_3d8ec0aea914605bd0455034673" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_streak" DROP CONSTRAINT "FK_3d8ec0aea914605bd0455034673"`,
    );
    await queryRunner.query(`DROP TABLE "user_streak"`);
  }
}
