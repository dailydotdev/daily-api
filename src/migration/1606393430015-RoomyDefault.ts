import {MigrationInterface, QueryRunner} from "typeorm";

export class RoomyDefault1606393430015 implements MigrationInterface {
    name = 'RoomyDefault1606393430015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ALTER COLUMN "spaciness" SET DEFAULT 'roomy'`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ALTER COLUMN "spaciness" SET DEFAULT 'eco'`, undefined);
    }

}
