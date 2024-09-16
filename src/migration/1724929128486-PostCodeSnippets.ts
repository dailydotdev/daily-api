import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostCodeSnippets1724929128486 implements MigrationInterface {
  name = 'PostCodeSnippets1724929128486';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_code_snippet" ("postId" text NOT NULL, "contentHash" text NOT NULL, "order" integer NOT NULL, "language" text NOT NULL DEFAULT 'plain', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "content" text NOT NULL, CONSTRAINT "PK_3e5fe344bf86e8d31d32a7440bb" PRIMARY KEY ("postId", "contentHash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e0dbd7a7243bddd0740b4589b" ON "post_code_snippet" ("order") `,
    );
    await queryRunner.query(
      `ALTER TABLE "post_code_snippet" ADD CONSTRAINT "FK_41925c29ce7a2820e87ff8d22fd" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_code_snippet" DROP CONSTRAINT "FK_41925c29ce7a2820e87ff8d22fd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3e0dbd7a7243bddd0740b4589b"`,
    );
    await queryRunner.query(`DROP TABLE "post_code_snippet"`);
  }
}
