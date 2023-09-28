import { FastifyRequest } from 'fastify';
import { User } from './entity';

type FlagValue = string | number | boolean | null;

export interface FeatureFlag {
  [key: string]: {
    enabled: boolean;
    value: FlagValue;
  };
}

export const DEFAULT_FLAGS = {
  feed_version: {
    enabled: true,
    value: process.env.NODE_ENV === 'production' ? 15 : 1,
  },
  onboarding_v2: {
    enabled: true,
    value: 'v1',
  },
  submit_article: {
    enabled: false,
    value: '',
  },
};

export const DEFAULT_INTERNAL_FLAGS = { squad: { enabled: true, value: '' } };

export const getUserFeatureFlags = (req: FastifyRequest): FeatureFlag => {
  const external = DEFAULT_FLAGS;
  const internal = req.userId ? DEFAULT_INTERNAL_FLAGS : {};

  return { ...external, ...internal };
};

export const submitArticleThreshold = parseInt(
  process.env.SUBMIT_ARTICLE_THRESHOLD,
);
const getSubmitArticleState = (flags: FeatureFlag, user: User) => {
  if (!flags?.submit_article?.enabled) {
    if (user?.reputation >= submitArticleThreshold) {
      return {
        enabled: true,
        value: '',
      };
    }
  }

  return flags?.submit_article;
};

interface UpdateParam {
  feature: string;
  checkIsApplicable(value: FlagValue): boolean;
}

export const adjustAnonymousFlags = (
  flags: FeatureFlag,
  updates: UpdateParam[],
): FeatureFlag => {
  const updatedFlags = { ...flags };

  updates.forEach(({ feature, checkIsApplicable }) => {
    if (!flags?.[feature]?.enabled) return;

    if (!checkIsApplicable(flags[feature].value)) {
      updatedFlags[feature] = { enabled: false, value: null };
    }
  });

  return updatedFlags;
};

export const adjustFlagsToUser = (
  flags: FeatureFlag,
  user: User,
): FeatureFlag => {
  flags.submit_article = getSubmitArticleState(flags, user);
  return flags;
};
