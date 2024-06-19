import { MigrationInterface, QueryRunner } from "typeorm";

export class ProfileImage1718794786874 implements MigrationInterface {
    name = 'ProfileImage1718794786874'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "user" SET "image" = $1 WHERE "image" = $2`, [
        'https://res.cloudinary.com/daily-now/image/upload/s--O0TOmw4y--/f_auto/v1715772965/public/noProfile',
        'https://daily-now-res.cloudinary.com/image/upload/f_auto/v1664367305/placeholders/placeholder3',
      ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "user" SET "image" = $1 WHERE "image" = $2;`, [
        'https://daily-now-res.cloudinary.com/image/upload/f_auto/v1664367305/placeholders/placeholder3',
        'https://res.cloudinary.com/daily-now/image/upload/s--O0TOmw4y--/f_auto/v1715772965/public/noProfile',
      ])
    }
}
