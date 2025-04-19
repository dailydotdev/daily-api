import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecialUserDeleteTrigger1744972478032
  implements MigrationInterface
{
  name = 'SpecialUserDeleteTrigger1744972478032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP RULE prototect_ghostuser_deletion on "user";`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_special_user_delete()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.id IN ('404', 'system') THEN
          RETURN NULL;
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER prevent_special_user_delete_trigger
      BEFORE DELETE ON "user"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_special_user_delete();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER prevent_special_user_delete_trigger ON "user";`,
    );
    await queryRunner.query(`
      DROP FUNCTION prevent_special_user_delete();
    `);
    await queryRunner.query(
      `CREATE RULE prototect_ghostuser_deletion AS ON DELETE TO "user" WHERE old.id IN ('404') DO INSTEAD nothing;`,
    );
  }
}
