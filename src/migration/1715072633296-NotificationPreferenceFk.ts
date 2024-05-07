import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationPreferenceFk1715072633296 implements MigrationInterface {
    name = 'NotificationPreferenceFk1715072633296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM notification_preference WHERE "userId" IN (
                SELECT "userId" FROM (SELECT DISTINCT "userId"
                FROM notification_preference np) b LEFT JOIN "public"."user" u ON b."userId" = u.id WHERE id IS NULL
            );`
        )
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_c8721bd56ae600308745ad49744" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_c8721bd56ae600308745ad49744"`);
    }

}
