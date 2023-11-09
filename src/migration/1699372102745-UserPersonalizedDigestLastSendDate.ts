import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPersonalizedDigestLastSendDate1699372102745 implements MigrationInterface {
    name = 'UserPersonalizedDigestLastSendDate1699372102745'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD "lastSendDate" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP COLUMN "lastSendDate"`);
    }

}
