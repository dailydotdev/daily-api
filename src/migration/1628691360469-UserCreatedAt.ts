import {MigrationInterface, QueryRunner} from "typeorm";

export class UserCreatedAt1628691360469 implements MigrationInterface {
    name = 'UserCreatedAt1628691360469'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "createdAt" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_user_createdAt" ON "public"."user" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_user_createdAt"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "createdAt"`);
    }

}
