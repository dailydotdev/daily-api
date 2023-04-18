import {
  defaultKeyGenerator,
  rateLimitDirective,
} from 'graphql-rate-limit-directive';
import {
  IRateLimiterRedisOptions,
  RateLimiterRedis,
} from 'rate-limiter-flexible';
import { GraphQLError } from 'graphql';
import { ioRedisPool } from '../redis';
import { Context } from '../Context';

const keyGenerator = (directiveArgs, source, args, context, info) =>
  `${context.userId ?? context.trackingId}:${defaultKeyGenerator(
    directiveArgs,
    source,
    args,
    context,
    info,
  )}`;

class RateLimitError extends GraphQLError {
  extensions = {};
  message = '';
  constructor(msBeforeNextReset) {
    const seconds = (msBeforeNextReset / 1000).toFixed(0);
    const message = `Too many requests, please try again in ${seconds} seconds.`;
    super(message);

    this.message = message;
    this.extensions = { code: 'RATE_LIMITED' };
  }
}

const onLimit = (resource) => {
  throw new RateLimitError(resource.msBeforeNext);
};

export const getRateLimitDirective = async () => {
  let redis;
  await ioRedisPool.execute(async (client) => (redis = client));
  // const redis = await ioRedisPool.getConnection(); // this one fails on test suites

  return rateLimitDirective<Context, IRateLimiterRedisOptions>({
    keyGenerator,
    onLimit,
    name: 'rateLimit',
    limiterOptions: {
      storeClient: redis,
    },
    limiterClass: RateLimiterRedis,
  });
};
