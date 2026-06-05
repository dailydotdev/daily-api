import type { PostHeroSignificance } from '../entity/PostHero';

export const POST_HERO_LIFECYCLE_HEADLINES: Partial<
  Record<PostHeroSignificance, string>
> = {
  breakout: 'Breaking out',
  evergreen: 'Evergreen',
};
