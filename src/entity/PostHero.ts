import { ViewColumn, ViewEntity } from 'typeorm';

export type PostHeroSignificance =
  | 'breaking'
  | 'major'
  | 'notable'
  | 'routine'
  | 'breakout'
  | 'evergreen';

@ViewEntity({
  name: 'post_hero',
  materialized: true,
  synchronize: false,
})
export class PostHero {
  @ViewColumn()
  id: string;

  @ViewColumn()
  postId: string;

  @ViewColumn()
  headline: string;

  @ViewColumn()
  significance: PostHeroSignificance;

  @ViewColumn()
  highlightedAt: Date;
}
