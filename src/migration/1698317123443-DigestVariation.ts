import { MigrationInterface, QueryRunner } from "typeorm";

export class DigestVariation1698317123443 implements MigrationInterface {
    name = 'DigestVariation1698317123443'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD "variation" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP COLUMN "variation"`);
    }

}
