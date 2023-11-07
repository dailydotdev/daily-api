import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPersonalizedDigestSubscribeTrigger1699284661116 implements MigrationInterface {
    name = 'UserPersonalizedDigestSubscribeTrigger1699284661116'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
      queryRunner.query('CREATE TRIGGER user_personalized_digest_subscribe AFTER INSERT ON "user" FOR EACH ROW EXECUTE PROCEDURE user_personalized_digest_subscribe()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS user_personalized_digest_subscribe ON "user"')
      queryRunner.query('DROP FUNCTION IF EXISTS user_personalized_digest_subscribe')
    }

}
