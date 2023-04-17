import {
  defaultKeyGenerator,
  rateLimitDirective,
} from 'graphql-rate-limit-directive';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// for debugging purposes
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }

  a;
}

const keyGenerator = (directiveArgs, source, args, context, info) =>
  `${context.userId ?? context.trackingId}:${defaultKeyGenerator(
    directiveArgs,
    source,
    args,
    context,
    info,
  )}`;

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
  rateLimitDirective({
    keyGenerator,
    limiterClass:
      process.env.NODE_ENV === 'development'
        ? DebugRateLimiterMemory
        : undefined,
  });

export { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer };
