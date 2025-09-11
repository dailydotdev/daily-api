import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationReplication1757339900267
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(/* sql */ `
      ALTER TABLE "public"."organization" REPLICA IDENTITY FULL;
    `);

    queryRunner.query(/* sql */ `
      ALTER TABLE "public"."opportunity_match" REPLICA IDENTITY FULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(/* sql */ `
      ALTER TABLE "public"."opportunity_match" REPLICA IDENTITY DEFAULT;
    `);

    queryRunner.query(/* sql */ `
      ALTER TABLE "public"."organization" REPLICA IDENTITY DEFAULT;
    `);
  }
}
