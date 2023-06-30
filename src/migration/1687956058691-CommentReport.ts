import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentReport1687956058691 implements MigrationInterface {
    name = 'CommentReport1687956058691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comment_report" ("commentId" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reason" character varying(36) NOT NULL, "note" text, CONSTRAINT "PK_cef0f7f862ea6ffd5a99dd640eb" PRIMARY KEY ("commentId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_comment_report_comment_id" ON "comment_report" ("commentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_comment_report_user_id" ON "comment_report" ("userId") `);
        await queryRunner.query(`ALTER TABLE "comment_report" ADD CONSTRAINT "FK_f5d76a882255aab76133a175b55" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment_report" DROP CONSTRAINT "FK_f5d76a882255aab76133a175b55"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_report_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_report_comment_id"`);
        await queryRunner.query(`DROP TABLE "comment_report"`);
    }

}
