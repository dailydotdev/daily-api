import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentMentionEntity1646123000110 implements MigrationInterface {
  name = 'CommentMentionEntity1646123000110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comment_mention" ("commentId" character varying(14) NOT NULL, "commentByUserId" character varying(36) NOT NULL, "mentionedUserId" character varying(36) NOT NULL, CONSTRAINT "PK_e80f73949dcc5d28b60ff4eadcf" PRIMARY KEY ("commentId", "commentByUserId", "mentionedUserId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" ADD CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" ADD CONSTRAINT "FK_bd51d362dd91064109b22f29061" FOREIGN KEY ("commentByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "comment_mention" DROP CONSTRAINT "FK_bd51d362dd91064109b22f29061"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_mention" DROP CONSTRAINT "FK_f8dbf9ed06bbdc84d8a5e99f7e4"`,
    );
    await queryRunner.query(`DROP TABLE "comment_mention"`);
  }
}
