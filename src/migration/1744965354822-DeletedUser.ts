import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeletedUser1744965354822 implements MigrationInterface {
  name = 'DeletedUser1744965354822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "deleted_user" ("id" character varying(36) NOT NULL, "userDeletedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e85dad6b83f0681a83fd04fe691" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION soft_delete_user()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO deleted_user (id) VALUES (OLD.id);
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER soft_delete_user_trigger
      AFTER DELETE ON public.user
      FOR EACH ROW
      EXECUTE FUNCTION soft_delete_user();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS soft_delete_user_trigger ON public."user";
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS soft_delete_user();
    `);

    await queryRunner.query(`DROP TABLE "deleted_user"`);
  }
}
