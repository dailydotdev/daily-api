import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentMentionEntity1645080894880 implements MigrationInterface {
  name = 'CommentMentionEntity1645080894880';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comment_mention" ("commentId" character varying NOT NULL, "mentionedUserId" character varying NOT NULL, CONSTRAINT "PK_d545a779ffe31921ed0d25b5846" PRIMARY KEY ("commentId", "mentionedUserId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" ADD CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment_mention" DROP CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4"`,
    );
    await queryRunner.query(`DROP TABLE "comment_mention"`);
  }
}
