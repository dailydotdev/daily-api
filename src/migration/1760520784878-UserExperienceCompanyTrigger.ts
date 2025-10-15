import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceCompanyTrigger1760520784878
  implements MigrationInterface
{
  name = 'UserExperienceCompanyTrigger1760520784878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION validate_user_experience()
      RETURNS TRIGGER AS $$
      BEGIN
          IF EXISTS (
              SELECT 1
              FROM user_company uc
              WHERE uc."userId" = NEW."userId"
              AND uc."companyId" = NEW."companyId"
              AND uc.verified = true
          ) THEN
              NEW.verified := TRUE;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER trigger_user_experience_before_insert
      BEFORE INSERT ON public.user_experience
      FOR EACH ROW WHEN (NEW.type = 'work' AND NEW."companyId" IS NOT NULL)
      EXECUTE FUNCTION validate_user_experience();
    `);

    // create another function and trigger for updates on user_experience table when the companyId is updated
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION validate_user_experience_on_update()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."companyId" IS NULL THEN
          IF NEW.verified = true THEN
            NEW.verified := FALSE;
          END IF;
          RETURN NEW;
        END IF;
        
        NEW.verified := EXISTS (
          SELECT 1
          FROM user_company uc
          WHERE uc."userId"    = NEW."userId"
            AND uc."companyId" = NEW."companyId"
            AND uc.verified    = TRUE
        );

        RETURN NEW;
        
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER trigger_user_experience_before_update
      BEFORE UPDATE ON public.user_experience
      FOR EACH ROW WHEN (
        NEW.type = 'work' AND
        COALESCE(NEW."companyId", '') != COALESCE(OLD."companyId", '')
      )
      EXECUTE FUNCTION validate_user_experience_on_update();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the update trigger
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_user_experience_before_update ON public.user_experience;`,
    );

    // Drop the update trigger function
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS validate_user_experience_on_update;`,
    );

    // Drop the trigger
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_user_experience_before_insert ON public.user_experience;`,
    );

    // Drop the trigger function
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS validate_user_experience;`,
    );
  }
}
