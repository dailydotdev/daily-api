import { MigrationInterface, QueryRunner } from "typeorm";

export class ReadingReminder1711962800897 implements MigrationInterface {
    name = 'ReadingReminder1711962800897'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD "type" text NOT NULL DEFAULT 'digest'`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP CONSTRAINT "PK_5a85f8949f0533d2bd25ca15ea0"`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD CONSTRAINT "PK_4282b68ab087b985f977dca66bf" PRIMARY KEY ("userId", "type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP CONSTRAINT "PK_4282b68ab087b985f977dca66bf"`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD CONSTRAINT "PK_5a85f8949f0533d2bd25ca15ea0" PRIMARY KEY ("userId")`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP COLUMN "type"`);
    }

}
