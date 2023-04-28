import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionEntity1682673635953 implements MigrationInterface {
  name = 'ActionEntity1682673635953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "action" ("userId" text NOT NULL, "type" text NOT NULL, "completedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("userId", "type"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2e3f7568dafa9e86ae0391011" ON "action" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_11db75ea5697b4c806aedc0739" ON "action" ("type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_11db75ea5697b4c806aedc0739"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b2e3f7568dafa9e86ae0391011"`,
    );
    await queryRunner.query(`DROP TABLE "action"`);
  }
}
