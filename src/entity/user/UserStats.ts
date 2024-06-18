import { DataSource, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('u."id"')
      .addSelect(
        `(SELECT COALESCE(COUNT(*), 0)
          FROM "user"
          WHERE "referralId" = u."id"
        )`,
        'referrals',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(p."views"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        )`,
        'views',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(p."upvotes"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        )`,
        'postUpvotes',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(c."upvotes"), 0)
          FROM "comment" c
          WHERE c."userId" = u."id"
        )`,
        'commentUpvotes',
      )
      .from('user', 'u')
      .andWhere('u.infoConfirmed = TRUE')
      .andWhere("u.id != '404'"),
})
export class UserStats {
  @ViewColumn()
  id: string;

  @ViewColumn()
  referrals: number;

  @ViewColumn()
  views: number;

  @ViewColumn()
  postUpvotes: number;

  @ViewColumn()
  commentUpvotes: number;
}
