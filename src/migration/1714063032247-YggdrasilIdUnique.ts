import { MigrationInterface, QueryRunner } from "typeorm";

export class YggdrasilIdUnique1714063032247 implements MigrationInterface {
    name = 'YggdrasilIdUnique1714063032247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_yggdrasil_id"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_yggdrasil_id" ON "post" ("yggdrasilId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_yggdrasil_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_yggdrasil_id" ON "post" ("yggdrasilId") `);
    }

}
