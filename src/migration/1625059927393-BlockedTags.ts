import {MigrationInterface, QueryRunner} from "typeorm";

export class BlockedTags1625059927393 implements MigrationInterface {
    name = 'BlockedTags1625059927393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_post_tsv"`);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" ADD "blocked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_post_tsv" ON "public"."post" ("tsv") `);
        await queryRunner.query(`CREATE INDEX "IDX_feedTag_blocked" ON "public"."feed_tag" ("blocked") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_feedTag_blocked"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_tsv"`);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" DROP COLUMN "blocked"`);
        await queryRunner.query(`CREATE INDEX "idx_post_tsv" ON "public"."post" ("tsv") `);
    }

}
