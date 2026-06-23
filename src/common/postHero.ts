import type { PostHeroSignificance } from '../entity/PostHero';

export const POST_HERO_LIFECYCLE_HEADLINES: Partial<
  Record<PostHeroSignificance, string>
> = {
  breakout: 'Breaking out',
  evergreen: 'Evergreen',
};

export const POST_HERO_SIZES: Record<PostHeroSignificance, number> = {
  breaking: 4,
  major: 3,
  notable: 2,
  routine: 1,
  breakout: 2,
  evergreen: 2,
};
