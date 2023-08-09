import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostQuestion1691592305690 implements MigrationInterface {
  name = 'PostQuestion1691592305690';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_question" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "postId" text NOT NULL, "question" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e863c320fd606cd1eb2f5c22448" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c740e7b1564ee3e52aef9f21fe" ON "post_question" ("postId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "post_question" ADD CONSTRAINT "FK_c740e7b1564ee3e52aef9f21fe0" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_question" DROP CONSTRAINT "FK_c740e7b1564ee3e52aef9f21fe0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c740e7b1564ee3e52aef9f21fe"`,
    );
    await queryRunner.query(`DROP TABLE "post_question"`);
  }
}
