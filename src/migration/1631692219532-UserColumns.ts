import {MigrationInterface, QueryRunner} from "typeorm";

export class UserColumns1631692219532 implements MigrationInterface {
    name = 'UserColumns1631692219532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "email" text`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "company" text`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "title" text`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "infoConfirmed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "acceptedMarketing" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "bio" text`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "github" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "portfolio" text`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "hashnode" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "updatedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "hashnode"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "portfolio"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "github"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "acceptedMarketing"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "infoConfirmed"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "company"`);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "email"`);
    }

}
