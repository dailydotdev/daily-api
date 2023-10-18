import { MigrationInterface, QueryRunner } from "typeorm";

export class TagSearchIndex1697642145710 implements MigrationInterface {
    name = 'TagSearchIndex1697642145710'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_62546896d355cd76b00352cf68" ON "keyword" ("value", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_62546896d355cd76b00352cf68"`);
    }

}
