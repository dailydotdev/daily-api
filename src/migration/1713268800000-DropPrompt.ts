import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPrompt1713268800000 implements MigrationInterface {
  name = 'DropPrompt1713268800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_d8e3aa07a95560a445ad50fb93"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_prompt_order"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "prompt" (
        "id" text NOT NULL,
        "order" integer NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "prompt" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "flags" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_d8e3aa07a95560a445ad50fb931" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d8e3aa07a95560a445ad50fb93" ON "prompt" ("id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prompt_order" ON "prompt" ("order")`,
    );
  }
}
