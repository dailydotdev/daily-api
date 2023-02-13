import { FastifyRequest } from 'fastify';
import pTimeout from 'p-timeout';
import flagsmith, { IFlags } from './flagsmith';
import { DataSource } from 'typeorm';
import { Feature } from './entity';

const FLAGSMITH_TIMEOUT = 1000;
export const DEFAULT_FLAGS = {
  feed_version: {
    enabled: true,
    value: 10,
  },
  my_feed_on: {
    enabled: true,
    value: '',
  },
};

const getExternalFeatureFlags = async (req: FastifyRequest) => {
  const { trackingId } = req;
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

const getInternalFeatureFlags = async (
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
  const flags = { ...external, ...internal };
  // TODO: once we move more parts we can take it into account
  // flags.submit_article = getSubmitArticleState(flags, base.user);
  return flags;
};
