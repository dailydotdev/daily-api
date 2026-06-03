import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrendsSource1780491180613 implements MigrationInterface {
  name = 'TrendsSource1780491180613';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Machine source for yggdrasil "trend" collections (collections whose seed
    // member is not news/release). Sibling of the 'collections' source.
    // NOTE: image reuses the collections logo as an interim placeholder —
    // replace with a dedicated Trends asset when available.
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "handle", "private", "image") VALUES ('trends', 'Trends', 'trends', 'false', 'https://daily-now-res.cloudinary.com/image/upload/s--iK6zGJCz--/f_auto,t_logo/v1698841319/logos/collections.jpg') ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE "id" = 'trends'`,
    );
  }
}
