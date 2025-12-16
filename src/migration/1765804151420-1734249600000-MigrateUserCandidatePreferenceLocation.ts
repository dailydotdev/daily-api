import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateUserCandidatePreferenceLocation1765804151420
  implements MigrationInterface
{
  name = 'MigrateUserCandidatePreferenceLocation1765804151420';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        RENAME COLUMN "location" TO "customLocation"
    `);

    await queryRunner.query(/* sql */ `
      COMMENT ON COLUMN "user_candidate_preference"."customLocation" IS 'Custom location from protobuf schema (legacy)'
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        ADD "locationId" uuid
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_candidate_preference_locationId"
        ON "user_candidate_preference" ("locationId")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        ADD CONSTRAINT "FK_user_candidate_preference_dataset_location_locationId"
          FOREIGN KEY ("locationId")
          REFERENCES "dataset_location"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        DROP CONSTRAINT "FK_user_candidate_preference_dataset_location_locationId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "public"."IDX_user_candidate_preference_locationId"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        DROP COLUMN "locationId"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_candidate_preference"
        RENAME COLUMN "customLocation" TO "location"
    `);

    await queryRunner.query(/* sql */ `
      COMMENT ON COLUMN "user_candidate_preference"."location" IS 'Location from protobuf schema'
    `);
  }
}
