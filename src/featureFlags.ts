import { FastifyRequest } from 'fastify';
import { DataSource } from 'typeorm';
import { Feature, User } from './entity';

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
    value: process.env.NODE_ENV === 'production' ? 11 : 1,
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

export const getInternalFeatureFlags = async (
  con: DataSource,
  userId?: string,
): Promise<FeatureFlag> => {
  if (userId) {
    const features = await con.getRepository(Feature).findBy({ userId });
    return features.reduce((prev, { feature }) => {
      prev[feature] = { enabled: true };
      return prev;
    }, {});
  }
  return {};
};

export const getUserFeatureFlags = async (
  req: FastifyRequest,
  con: DataSource,
): Promise<FeatureFlag> => {
  const [external, internal] = await Promise.all([
    Promise.resolve(DEFAULT_FLAGS),
    getInternalFeatureFlags(con, req.userId),
  ]);
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
