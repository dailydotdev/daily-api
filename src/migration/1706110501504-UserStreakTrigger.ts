import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakTrigger1706110501504 implements MigrationInterface {
  name = 'UserStreakTrigger1706110501504';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_user_streak()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO user_streak ("userId")
          VALUES (NEW.id);
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER trigger_user_after_insert
      AFTER INSERT ON public.user
      FOR EACH ROW
      EXECUTE FUNCTION create_user_streak();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the trigger
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_user_after_insert ON public.user;`,
    );

    // Drop the trigger function
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_user_streak;`);
  }
}
