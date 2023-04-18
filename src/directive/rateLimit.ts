import {
  defaultKeyGenerator,
  rateLimitDirective,
} from 'graphql-rate-limit-directive';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { GraphQLError } from 'graphql';

export let rateLimiter: DebugRateLimiterMemory;

export class DebugRateLimiterMemory extends RateLimiterMemory {
  constructor(props) {
    super(props);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    rateLimiter = this;
  }

  // for debugging purposes
  consume(key, pointsToConsume, options) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    }

    return super.consume(key, pointsToConsume, options);
  }
}

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

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
  rateLimitDirective({
    keyGenerator,
    onLimit,
    limiterClass: DebugRateLimiterMemory,
  });

export { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer };
