import {MigrationInterface, QueryRunner} from "typeorm";

export class KeywordOccurrences1609235813074 implements MigrationInterface {
    name = 'KeywordOccurrences1609235813074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "occurrences" integer NOT NULL DEFAULT 0`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_occurrences" ON "public"."keyword" ("occurrences") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_occurrences"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "occurrences"`, undefined);
    }

}
