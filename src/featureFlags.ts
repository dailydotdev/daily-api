import { FastifyRequest } from 'fastify';
import pTimeout from 'p-timeout';
import flagsmith, { IFlags } from './flagsmith';
import { DataSource } from 'typeorm';
import { Feature, User } from './entity';
import { Flag } from 'flagsmith-nodejs/sdk/models';

const FLAGSMITH_TIMEOUT = 1000;
export const DEFAULT_FLAGS = {
  feed_version: {
    enabled: true,
    value: process.env.NODE_ENV === 'production' ? 10 : 1,
  },
  my_feed_on: {
    enabled: true,
    value: '',
  },
};

export const getExternalFeatureFlags = async (req: FastifyRequest) => {
  const trackingId = req.userId || req.trackingId;
  if (trackingId) {
    try {
      const { flags } = await pTimeout(
        flagsmith.getIdentityFlags(trackingId),
        FLAGSMITH_TIMEOUT,
      );
      if (!flags) {
        return { ...DEFAULT_FLAGS };
      }
      // Extract only enabled and value
      return Object.keys(flags).reduce(
        (acc, key) => ({
          ...acc,
          [key]: {
            enabled: flags[key].enabled,
            value: flags[key].value,
          },
        }),
        {},
      );
    } catch (err) {
      req.log.error({ err }, 'failed to fetch feature flags');
    }
  }
  return { ...DEFAULT_FLAGS };
};

export const getInternalFeatureFlags = async (
  con: DataSource,
  userId?: string,
): Promise<IFlags> => {
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
): Promise<IFlags> => {
  const [external, internal] = await Promise.all([
    getExternalFeatureFlags(req),
    getInternalFeatureFlags(con, req.userId),
  ]);
  return { ...external, ...internal };
};

const submitArticleThreshold = parseInt(process.env.SUBMIT_ARTICLE_THRESHOLD);
const getSubmitArticleState = (flags: IFlags, user: User) => {
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
  replacement: Flag['value'];
  onCheckValidity(value: Flag['value']): boolean;
}

export const adjustAnonymousFlags = (
  flags: IFlags,
  updates: UpdateParam[],
): IFlags => {
  updates.forEach(({ feature, onCheckValidity, replacement }) => {
    const isValid = onCheckValidity(flags[feature].value);
    if (flags[feature].enabled && isValid) {
      flags[feature] = { enabled: true, value: replacement };
    }
  });

  return flags;
};

export const adjustFlagsToUser = (flags: IFlags, user: User): IFlags => {
  flags.submit_article = getSubmitArticleState(flags, user);
  return flags;
};
