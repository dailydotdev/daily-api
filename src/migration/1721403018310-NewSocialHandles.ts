import { MigrationInterface, QueryRunner } from "typeorm";

export class NewSocialHandles1721403018310 implements MigrationInterface {
    name = 'NewSocialHandles1721403018310'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "roadmap" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "threads" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "codepen" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "reddit" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "stackoverflow" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "youtube" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "linkedin" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "mastodon" character varying(39)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mastodon"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "linkedin"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "youtube"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "stackoverflow"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "reddit"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "codepen"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "threads"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "roadmap"`);
    }

}
