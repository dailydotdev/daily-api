import { MigrationInterface, QueryRunner } from "typeorm";

export class Notification1700836062543 implements MigrationInterface {
    name = 'Notification1700836062543'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "numTotalAvatars" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "numTotalAvatars"`);
    }
}
