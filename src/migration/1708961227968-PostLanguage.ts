import { MigrationInterface, QueryRunner } from "typeorm";

export class PostLanguage1708961227968 implements MigrationInterface {
    name = 'PostLanguage1708961227968'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "language" text DEFAULT 'en'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "language"`);
    }
}
