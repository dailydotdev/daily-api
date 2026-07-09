import { MigrationInterface, QueryRunner } from 'typeorm';

export class XTrendsSource1783950000000 implements MigrationInterface {
  name = 'XTrendsSource1783950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "public"."source" ("id", "name", "handle", "private", "image")
        VALUES ('x-trends', 'Trending on X', 'x-trends', 'false', 'https://daily-now-res.cloudinary.com/image/upload/s--iK6zGJCz--/f_auto,t_logo/v1698841319/logos/collections.jpg')
        ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "public"."source" WHERE "id" = 'x-trends'
    `);
  }
}
