import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentDownvotes1711384423929 implements MigrationInterface {
    name = 'CommentDownvotes1711384423929'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment" ADD "downvotes" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_comment_downvotes" ON "comment" ("downvotes") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_downvotes"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "downvotes"`);
    }

}
