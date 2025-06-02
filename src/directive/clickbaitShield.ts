import { AuthenticationError } from 'apollo-server-errors';
import { defaultFieldResolver } from 'graphql';
import { GraphQLSchema } from 'graphql';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { Context } from '../Context';
import { tryIncrement } from '../common/redis/clickbaitShieldCounter';

const directiveName = 'clickbaitShield';

export const typeDefs = /* GraphQL */ `
  """
  Directive that limits the number of times a non-Plus user can perform an action per month (using clickbaitShieldCounter).
  """
  directive @${directiveName} on OBJECT | FIELD_DEFINITION
`;

export const transformer = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const clickbaitShieldDirective = getDirective(
        schema,
        fieldConfig,
        directiveName,
      )?.[0];

      if (clickbaitShieldDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
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
            if (!ctx.isPlus) {
              const allowed = await tryIncrement(ctx.userId);
              if (!allowed) {
                throw new AuthenticationError(
                  'You have reached your monthly limit for this action. Upgrade to Plus for unlimited access.',
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
