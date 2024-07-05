import { MigrationInterface, QueryRunner } from "typeorm";

export class UserSourceIntegration1720103113795 implements MigrationInterface {
    name = 'UserSourceIntegration1720103113795'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_source_integration" ("userIntegrationId" uuid NOT NULL, "sourceId" text NOT NULL, "type" text NOT NULL, "channelIds" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_b69cf89edca5369626b1dda8d79" PRIMARY KEY ("userIntegrationId", "sourceId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_09106ee5e3d195be7290964bb8" ON "user_source_integration" ("type") `);
        await queryRunner.query(`ALTER TABLE "user_source_integration" ADD CONSTRAINT "FK_1c572e4710a6451699c48c2ece5" FOREIGN KEY ("userIntegrationId") REFERENCES "user_integration"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_source_integration" ADD CONSTRAINT "FK_4d2e0ef44957797dc421ad7fa83" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_source_integration" DROP CONSTRAINT "FK_4d2e0ef44957797dc421ad7fa83"`);
        await queryRunner.query(`ALTER TABLE "user_source_integration" DROP CONSTRAINT "FK_1c572e4710a6451699c48c2ece5"`);
        await queryRunner.query(`DROP TABLE "user_source_integration"`);
    }

}
