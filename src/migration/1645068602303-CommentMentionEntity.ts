import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentMentionEntity1645068602303 implements MigrationInterface {
  name = 'CommentMentionEntity1645068602303';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comment_upvote" ("commentId" character varying(14) NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a4d2cca0c16073a61a59b14811d" PRIMARY KEY ("commentId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc4f54a7d1d05d1a093bdad94f" ON "comment_upvote" ("commentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_727fa1c28202cdca652ce13b17" ON "comment_upvote" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_upvote" ADD CONSTRAINT "FK_fc4f54a7d1d05d1a093bdad94f6" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_upvote" ADD CONSTRAINT "FK_727fa1c28202cdca652ce13b17a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment_upvote" DROP CONSTRAINT "FK_727fa1c28202cdca652ce13b17a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_upvote" DROP CONSTRAINT "FK_fc4f54a7d1d05d1a093bdad94f6"`,
    );
    await queryRunner.query(`DROP TABLE "comment_upvote"`);
  }
}
