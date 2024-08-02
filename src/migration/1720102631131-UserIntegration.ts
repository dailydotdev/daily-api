import { MigrationInterface, QueryRunner } from "typeorm";

export class UserIntegration1720102631131 implements MigrationInterface {
    name = 'UserIntegration1720102631131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_integration" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "meta" jsonb DEFAULT '{}', CONSTRAINT "PK_40932041bfccddf1ed92667864b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f65f2e8ad23133abd53e72d9ca" ON "user_integration" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2fea6851864728d434165b7d22" ON "user_integration" ("type") `);
        await queryRunner.query(`ALTER TABLE "user_integration" ADD CONSTRAINT "FK_f65f2e8ad23133abd53e72d9ca0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_integration" DROP CONSTRAINT "FK_f65f2e8ad23133abd53e72d9ca0"`);
        await queryRunner.query(`DROP TABLE "user_integration"`);
    }

}
