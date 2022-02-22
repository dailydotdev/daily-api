import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentMentionEntity1645438828376 implements MigrationInterface {
  name = 'CommentMentionEntity1645438828376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comment_mention" ("commentId" character varying NOT NULL, "mentionedUserId" character varying NOT NULL, CONSTRAINT "PK_d545a779ffe31921ed0d25b5846" PRIMARY KEY ("commentId", "mentionedUserId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" ADD CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" ADD CONSTRAINT "FK_cc568f9fc855fc9ada0cfba6cd6" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment_mention" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" DROP CONSTRAINT "FK_cc568f9fc855fc9ada0cfba6cd6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" DROP CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4"`,
    );
    await queryRunner.query(`DROP TABLE "comment_mention"`);
  }
}
