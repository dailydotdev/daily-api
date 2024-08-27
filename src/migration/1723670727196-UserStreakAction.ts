import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakAction1723670727196 implements MigrationInterface {
  name = 'UserStreakAction1723670727196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_streak_action" ("userId" character varying(36) NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_875298ad33fc69f7d704042cdd4" PRIMARY KEY ("userId", "type", "createdAt"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD CONSTRAINT "FK_8f82dc90297a05bb4377ef811c9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP CONSTRAINT "FK_8f82dc90297a05bb4377ef811c9"`,
    );
    await queryRunner.query(`DROP TABLE "user_streak_action"`);
  }
}
