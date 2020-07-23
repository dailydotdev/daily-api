import {MigrationInterface, QueryRunner} from "typeorm";

export class UserNullable1595349858627 implements MigrationInterface {
    name = 'UserNullable1595349858627'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "name" DROP NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "image" DROP NOT NULL`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "image" SET NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "name" SET NOT NULL`, undefined);
    }

}
