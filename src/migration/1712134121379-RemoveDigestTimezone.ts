import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDigestTimezone1712134121379 implements MigrationInterface {
    name = 'RemoveDigestTimezone1712134121379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_personalized_digest_subscribe()
              RETURNS TRIGGER
              LANGUAGE PLPGSQL
              AS
            $$
            BEGIN
              INSERT INTO user_personalized_digest ("userId", "preferredHour", "preferredDay") VALUES (NEW.id, 8, 3) ON CONFLICT DO NOTHING;
              RETURN NEW;
            END;
            $$
        `)
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP COLUMN "preferredTimezone"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD "preferredTimezone" text NOT NULL DEFAULT 'Etc/UTC'`);
        queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_personalized_digest_subscribe()
              RETURNS TRIGGER
              LANGUAGE PLPGSQL
              AS
            $$
            BEGIN
              INSERT INTO user_personalized_digest ("userId", "preferredTimezone", "preferredHour", "preferredDay") VALUES (NEW.id, COALESCE(NULLIF(NEW.timezone, ''), 'Etc/UTC'), 8, 3) ON CONFLICT DO NOTHING;
              RETURN NEW;
            END;
            $$
        `)
    }

}
