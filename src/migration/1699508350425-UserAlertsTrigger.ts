import { MigrationInterface, QueryRunner } from "typeorm";

export class UserAlertsTrigger1699508350425 implements MigrationInterface {
    name = 'UserAlertsTrigger1699508350425'

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION insert_user_alerts()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          INSERT INTO public.alerts ("userId") VALUES (NEW."id");
          RETURN NEW;
        END;
        $$
      `)
    queryRunner.query('CREATE TRIGGER user_create_alerts_trigger AFTER INSERT ON public."user" FOR EACH ROW EXECUTE PROCEDURE insert_user_alerts()')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query('DROP TRIGGER IF EXISTS user_create_alerts_trigger ON public.user')
    queryRunner.query('DROP FUNCTION IF EXISTS insert_user_alerts')
  }

}
