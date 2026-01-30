import {
  RateLimitKeyGenerator,
  RateLimitOnLimit,
  RateLimitOptions,
  defaultKeyGenerator,
  defaultPointsCalculator,
  rateLimitDirective,
} from 'graphql-rate-limit-directive';
import {
  IRateLimiterRedisOptions,
  RateLimiterRedis,
} from 'rate-limiter-flexible';
import { GraphQLSchema } from 'graphql';
import humanizeDuration from 'humanize-duration';
import { singleRedisClient } from '../redis';
import { Context } from '../Context';
import { logger } from '../logger';
import { WATERCOOLER_ID } from '../common';
import { counters } from '../telemetry';
import { RateLimitError } from '../common/rateLimit';

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
      case 'createPollPost':
      case 'submitExternalLink':
      case 'sharePost':
      case 'createSourcePostModeration':
        return `${context.userId ?? context.trackingId}:createPost`;
      case 'commentOnPost':
      case 'commentOnComment':
        return `${context.userId ?? context.trackingId}:createComment`;
      case 'parseOpportunity':
        return `${context.userId ?? context.trackingId}:parseOpportunity`;
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

export const onLimit: RateLimitOnLimit<Context> = (
  resource,
  rlArgs,
  __,
  args,
  context,
  info,
) => {
  const period = humanizeDuration(rlArgs.duration * 1000);
  switch (info.fieldName) {
    case 'createFreeformPost':
    case 'createPollPost':
    case 'submitExternalLink':
    case 'sharePost':
    case 'createSourcePostModeration':
      counters?.api?.rateLimit?.add(1, { type: 'createPost' });
      throw new RateLimitError({
        message: `Take a break. You already posted enough in the last ${period}`,
      });
    case 'commentOnPost':
    case 'commentOnComment':
      counters?.api?.rateLimit?.add(1, { type: 'createComment' });
      throw new RateLimitError({
        message: `Take a break. You already commented enough in the last ${period}`,
      });
    case 'addUserCompany':
      counters?.api?.rateLimit?.add(1, { type: 'addUserCompany' });
      throw new RateLimitError({ msBeforeNextReset: resource.msBeforeNext });
    case 'verifyUserCompanyCode':
      counters?.api?.rateLimit?.add(1, { type: 'verifyUserCompanyCode' });
      throw new RateLimitError({ msBeforeNextReset: resource.msBeforeNext });
    case 'parseOpportunity':
      counters?.api?.rateLimit?.add(1, { type: 'parseOpportunity' });
      throw new RateLimitError({
        message: `You tried to parse job too many times. Try again in ${period} or contact team for assistance.`,
      });
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
  pointsCalculator: (directiveArgs, source, args, context, info) => {
    switch (info.fieldName) {
      case 'parseOpportunity':
        return context.isTeamMember ? 0 : 1;
      default:
        return defaultPointsCalculator(
          directiveArgs,
          source,
          args,
          context,
          info,
        );
    }
  },
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
