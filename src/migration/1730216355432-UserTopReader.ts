import { MigrationInterface, QueryRunner } from "typeorm";

export class UserTopReader1730216355432 implements MigrationInterface {
  name = 'UserTopReader1730216355432'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_top_reader" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "keywordValue" text NOT NULL, "image" text, CONSTRAINT "PK_32dd96f55e34926726b573b2840" PRIMARY KEY ("id", "userId"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_top_reader_id" ON "user_top_reader" ("id") `);
    await queryRunner.query(`CREATE INDEX "IDX_user_top_reader_userId_issuedAt" ON "user_top_reader" ("userId", "issuedAt" DESC)`);
    await queryRunner.query(`ALTER TABLE "user_top_reader" ADD CONSTRAINT "FK_8db78849191c339d5776307ff45" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_top_reader" ADD CONSTRAINT "FK_3c4d618581c0fb525b35de46164" FOREIGN KEY ("keywordValue") REFERENCES "keyword"("value") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_top_reader" DROP CONSTRAINT "FK_3c4d618581c0fb525b35de46164"`);
    await queryRunner.query(`ALTER TABLE "user_top_reader" DROP CONSTRAINT "FK_8db78849191c339d5776307ff45"`);
    await queryRunner.query(`DROP INDEX "IDX_user_top_reader_userId_issuedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_top_reader_id"`);
    await queryRunner.query(`DROP TABLE "user_top_reader"`);
  }
}
