import { AuthenticationError } from 'apollo-server-errors';
import { defaultFieldResolver } from 'graphql';
import { GraphQLSchema } from 'graphql';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { Context } from '../Context';
import { RedisCounter } from '../common/redis/redisCounters';
import {
  endOfDay,
  endOfWeek,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  addYears,
} from 'date-fns';

const directiveName = 'rateLimitCounter';

function getExpirationSeconds(period: string): number {
  const now = new Date();
  switch (period) {
    case 'monthly': {
      const end = endOfMonth(now);
      return Math.floor((end.getTime() - now.getTime()) / 1000);
    }
    case 'weekly': {
      const end = endOfWeek(now, { weekStartsOn: 0 }); // Sunday
      return Math.floor((end.getTime() - now.getTime()) / 1000);
    }
    case 'daily': {
      const end = endOfDay(now);
      return Math.floor((end.getTime() - now.getTime()) / 1000);
    }
    default: {
      // Try to parse as ISO8601 duration (e.g., 'P1D' for 1 day)
      // For simplicity, support 'PXD', 'PXW', 'PXM', 'PXY' (days, weeks, months, years)
      const match = /^P(\d+)([DWMY])$/.exec(period);
      if (match) {
        const value = parseInt(match[1], 10);
        let end: Date | null = null;
        switch (match[2]) {
          case 'D':
            end = addDays(now, value);
            break;
          case 'W':
            end = addWeeks(now, value);
            break;
          case 'M':
            end = addMonths(now, value);
            break;
          case 'Y':
            end = addYears(now, value);
            break;
        }
        if (end) {
          return Math.floor((end.getTime() - now.getTime()) / 1000);
        }
      }
      throw new Error(`Unsupported period: ${period}`);
    }
  }
}

export const typeDefs = /* GraphQL */ `
  """
  Directive that limits the number of times a user can perform an action per period (using a RedisCounter).
  - maxTries: Maximum allowed actions in the period (required)
  - period: String/Enum for the period ('monthly', 'weekly', 'daily', or ISO8601 duration like 'P7D') (required)
  - key: Optional string to namespace the counter (default: 'rate-limit-counter')
  - exceptPlus: If true, Plus users are exempt from the limit (default: true)
  """
  directive @${directiveName}(
    maxTries: Int!
    period: String!
    key: String
    exceptPlus: Boolean = true
  ) on OBJECT | FIELD_DEFINITION
`;

export const transformer = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const rateLimitCounterDirective = getDirective(
        schema,
        fieldConfig,
        directiveName,
      )?.[0];

      if (rateLimitCounterDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        const {
          maxTries,
          period,
          key,
          exceptPlus = true,
        } = rateLimitCounterDirective;
        if (!maxTries || !period || !key) {
          throw new Error(
            `@${directiveName} requires maxTries, key and period arguments.`,
          );
        }
        const expiration = getExpirationSeconds(period);
        const counter = new RedisCounter(key);
        fieldConfig.resolve = async function (
          source,
          args,
          ctx: Context,
          info,
        ) {
          if (['Query', 'Mutation'].includes(typeName)) {
            if (!ctx.userId) {
              throw new AuthenticationError(
                'Access denied! You need to be authorized to perform this action!',
              );
            }
            if (!(exceptPlus && ctx.isPlus)) {
              const used = await counter.get(ctx.userId);
              if (used < maxTries) {
                await counter.increment({ userId: ctx.userId, expiration });
              } else {
                throw new AuthenticationError(
                  exceptPlus
                    ? `You have reached your limit (${maxTries}) for this action. Upgrade to Plus for unlimited access or wait for the reset period.`
                    : `You have reached your limit (${maxTries}) for this action. Please wait for the reset period before trying again.`,
                );
              }
            }
            return resolve(source, args, ctx, info);
          }
        };
        return fieldConfig;
      }
    },
  });
