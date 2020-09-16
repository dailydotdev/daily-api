import {MigrationInterface, QueryRunner} from "typeorm";

export class Reputation1600267654798 implements MigrationInterface {
    name = 'Reputation1600267654798'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "reputation" integer NOT NULL DEFAULT 0`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "reputation"`, undefined);
    }

}
