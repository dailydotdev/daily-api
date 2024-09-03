import {
  RateLimitKeyGenerator,
  RateLimitOnLimit,
  RateLimitOptions,
  defaultKeyGenerator,
  rateLimitDirective,
} from 'graphql-rate-limit-directive';
import {
  IRateLimiterRedisOptions,
  RateLimiterRedis,
} from 'rate-limiter-flexible';
import { GraphQLError, GraphQLSchema } from 'graphql';
import { singleRedisClient } from '../redis';
import { Context } from '../Context';
import { logger } from '../logger';
import { WATERCOOLER_ID } from '../common';
import { counters } from '../telemetry';

export const highRateLimitedSquads = [WATERCOOLER_ID];

export class CustomRateLimiterRedis extends RateLimiterRedis {
  constructor(props: IRateLimiterRedisOptions) {
    super(props);
  }

  // Currently not doing any special actions/overrides
  // This was primarily introduced to make debugging easier by logging the details of rate limited queries/mutations after receiving a request
  consume(
    key: string | number,
    pointsToConsume?: number,
    options?: { [key: string]: unknown },
  ) {
    logger.debug(`[CONSUME] ${key} for ${pointsToConsume}`);

    return super.consume(key, pointsToConsume, options);
  }
}

const keyGenerator: RateLimitKeyGenerator<Context> = (
  directiveArgs,
  source,
  args,
  context,
  info,
) => {
  {
    switch (info.fieldName) {
      case 'createFreeformPost':
      case 'submitExternalLink':
      case 'sharePost':
        return `${context.userId ?? context.trackingId}:createPost`;
      case 'commentOnPost':
      case 'commentOnComment':
        return `${context.userId ?? context.trackingId}:createComment`;
      default:
        return `${context.userId ?? context.trackingId}:${defaultKeyGenerator(
          directiveArgs,
          source,
          args,
          context,
          info,
        )}`;
    }
  }
};

class RateLimitError extends GraphQLError {
  extensions = {};
  message = '';

  constructor({
    msBeforeNextReset = 0,
    message,
  }: {
    msBeforeNextReset?: number;
    message?: string;
  }) {
    const seconds = (msBeforeNextReset / 1000).toFixed(0);
    message = message ?? `Too many requests, please try again in ${seconds}s`;
    super(message);

    this.message = message;
    this.extensions = { code: 'RATE_LIMITED' };
  }
}

export const onLimit: RateLimitOnLimit<Context> = (
  resource,
  _,
  __,
  args,
  context,
  info,
) => {
  switch (info.fieldName) {
    case 'createFreeformPost':
    case 'submitExternalLink':
    case 'sharePost':
      counters?.api?.rateLimit?.add(1, { type: 'createPost' });
      const period = highRateLimitedSquads.includes(args.sourceId as string)
        ? 'ten minutes'
        : 'hour';
      throw new RateLimitError({
        message: `Take a break. You already posted enough in the last ${period}`,
      });
    case 'commentOnPost':
    case 'commentOnComment':
      counters?.api?.rateLimit?.add(1, { type: 'createComment' });
      throw new RateLimitError({
        message: 'Take a break. You already commented enough in the last hour',
      });
    case 'addUserCompany':
      counters?.api?.rateLimit?.add(1, { type: 'addUserCompany' });
      throw new RateLimitError({ msBeforeNextReset: resource.msBeforeNext });
    case 'verifyUserCompanyCode':
      counters?.api?.rateLimit?.add(1, { type: 'verifyUserCompanyCode' });
      throw new RateLimitError({ msBeforeNextReset: resource.msBeforeNext });
    default:
      counters?.api?.rateLimit?.add(1, { type: 'default' });
      throw new RateLimitError({ msBeforeNextReset: resource.msBeforeNext });
  }
};

export const rateLimiterName = 'rateLimit';
const rateLimiterConfig: RateLimitOptions<Context, IRateLimiterRedisOptions> = {
  keyGenerator,
  onLimit,
  name: rateLimiterName,
  limiterOptions: {
    storeClient: singleRedisClient,
  },
  limiterClass: CustomRateLimiterRedis,
};

const { rateLimitDirectiveTransformer, rateLimitDirectiveTypeDefs } =
  rateLimitDirective(rateLimiterConfig);

export const highRateLimiterName = 'highRateLimit';
const {
  rateLimitDirectiveTransformer: highRateLimitTransformer,
  rateLimitDirectiveTypeDefs: highRateLimitTypeDefs,
} = rateLimitDirective({
  ...rateLimiterConfig,
  name: highRateLimiterName,
  pointsCalculator: (_, __, args) =>
    highRateLimitedSquads.includes(args.sourceId as string) ? 1 : 0,
});

export const rateLimiterTransformers = (schema: GraphQLSchema) =>
  highRateLimitTransformer(rateLimitDirectiveTransformer(schema));

export const rateLimitTypeDefs = [
  rateLimitDirectiveTypeDefs,
  highRateLimitTypeDefs,
];
