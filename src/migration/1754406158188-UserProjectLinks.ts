import { MigrationInterface, QueryRunner } from "typeorm";

export class UserProjectLinks1754406158188 implements MigrationInterface {
    name = 'UserProjectLinks1754406158188'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_experience" DROP COLUMN "links"`);
        await queryRunner.query(`ALTER TABLE "user_experience" ADD "links" jsonb DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_experience" DROP COLUMN "links"`);
        await queryRunner.query(`ALTER TABLE "user_experience" ADD "links" text array DEFAULT '{}'`);
    }
}
