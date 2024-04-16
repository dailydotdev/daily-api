import { MigrationInterface, QueryRunner } from "typeorm";

export class PostContentMeta1713194178000 implements MigrationInterface {
    name = 'PostContentMeta1713194178000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "contentMeta" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentMeta"`);
    }

}
