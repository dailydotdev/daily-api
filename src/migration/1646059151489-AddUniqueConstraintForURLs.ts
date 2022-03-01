import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintForURLs1646059151489
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from post
where id in (
select p1.id
from post as p1
inner join post as p2 on (p1."url" = p2."url" OR p1."canonicalUrl" = p2."canonicalUrl") and p1.id != p2.id and p1."id" > p2."id"
);`);
    await queryRunner.query(
      `DROP INDEX "IDX_fb99ad6d900513655fd0882435"`,
      undefined,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_bd2cd5fdf6699875f262747372"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_post_url" ON "public"."post" ("url") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_post_canonicalUrl" ON "public"."post" ("canonicalUrl") `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_url"`, undefined);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_canonicalUrl"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb99ad6d900513655fd0882435" ON "public"."post" ("canonicalUrl") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd2cd5fdf6699875f262747372" ON "public"."post" ("url") `,
      undefined,
    );
  }
}
