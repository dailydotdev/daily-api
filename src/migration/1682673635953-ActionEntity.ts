import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionEntity1682673635953 implements MigrationInterface {
  name = 'ActionEntity1682673635953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_action" ("userId" text NOT NULL, "type" text NOT NULL, "completedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("userId", "type"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2e3f7568dafa9e86ae0391011" ON "user_action" ("userId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b2e3f7568dafa9e86ae0391011"`,
    );
    await queryRunner.query(`DROP TABLE "user_action"`);
  }
}
