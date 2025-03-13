import { MigrationInterface, QueryRunner } from "typeorm";

export class UserActiveSubscriptionDeleteProtect1741860900963 implements MigrationInterface {
  name = 'UserActiveSubscriptionDeleteProtect1741860900963'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `CREATE OR REPLACE FUNCTION prevent_delete_active_storekit_users()
      RETURNS TRIGGER AS $$
      BEGIN
          IF (OLD."subscriptionFlags"->>'status' = 'active') AND
            (OLD."subscriptionFlags"->>'provider' = 'storekit') THEN
              RAISE EXCEPTION 'Deletion is not allowed for users with an active subscription and StoreKit provider';
          END IF;
          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(/* sql */ `CREATE TRIGGER protect_active_storekit_users BEFORE DELETE ON "user" FOR EACH ROW
      EXECUTE FUNCTION prevent_delete_active_storekit_users ();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `DROP TRIGGER IF EXISTS protect_active_storekit_users ON "user"`);
    await queryRunner.query(/* sql */ `DROP FUNCTION IF EXISTS prevent_delete_active_storekit_users`);
  }

}
