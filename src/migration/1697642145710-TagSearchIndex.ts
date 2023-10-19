import { MigrationInterface, QueryRunner } from "typeorm";

export class TagSearchIndex1697642145710 implements MigrationInterface {
    name = 'TagSearchIndex1697642145710'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_status_value" ON "keyword" ("status", "value") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_status_value"`);
    }

}
