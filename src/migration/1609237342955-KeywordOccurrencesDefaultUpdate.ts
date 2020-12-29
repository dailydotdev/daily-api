import {MigrationInterface, QueryRunner} from "typeorm";

export class KeywordOccurrencesDefaultUpdate1609237342955 implements MigrationInterface {
    name = 'KeywordOccurrencesDefaultUpdate1609237342955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."keyword" ALTER COLUMN "occurrences" SET DEFAULT 1`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."keyword" ALTER COLUMN "occurrences" SET DEFAULT 0`, undefined);
    }

}
