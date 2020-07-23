import {MigrationInterface, QueryRunner} from "typeorm";

export class User1595345916300 implements MigrationInterface {
    name = 'User1595345916300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."user" ("id" character varying(36) NOT NULL, "name" text NOT NULL, "image" text NOT NULL, CONSTRAINT "PK_03b91d2b8321aa7ba32257dc321" PRIMARY KEY ("id"))`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "public"."user"`, undefined);
    }

}
