import { ViewEntity, ViewColumn, Index } from 'typeorm';

@ViewEntity({
  materialized: true,
  expression: `
    with keywords as (
        select pk."postId", pk.keyword
        from post_keyword pk
        join post p on p.id = pk."postId"
        where p."createdAt" >= (current_timestamp - interval '60 day')::date and pk.status = 'allow'
    ), totals as (
        select keyword, count(*) total
        from keywords
        group by 1
    ), filtered as (
        select k.*
        from keywords k
        join totals t on t.keyword = k.keyword
        where t.total >= 100
    ), pairs as (
        select k1.keyword "keywordX", k2.keyword "keywordY"
        from filtered k1
        join filtered k2 on k1."postId" = k2."postId" and k1.keyword != k2.keyword
    ), likelihood as (
        select "keywordX", "keywordY", count(*) * 1.0 / min(t.total) as probability
        from pairs p
        join totals t on p."keywordX" = t.keyword
        group by 1, 2
    )
    select * from likelihood
    where probability > 0.05
  `,
})
@Index(['keywordX', 'keywordY', 'probability'])
export class TagRecommendation {
  @ViewColumn()
  keywordX: string;

  @ViewColumn()
  keywordY: string;

  @ViewColumn()
  probability: number;
}
