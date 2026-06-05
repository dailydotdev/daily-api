import { AuthenticationError } from 'apollo-server-errors';
import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { Context } from '../Context';
import { assertContributionEligible } from '../common/contribution';

const directiveName = 'contributionEligibility';

export const typeDefs = /* GraphQL */ `
  directive @${directiveName} on FIELD_DEFINITION
`;

export const transformer = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
      if (!directive) {
        return fieldConfig;
      }

      const { resolve = defaultFieldResolver } = fieldConfig;
      fieldConfig.resolve = async function (source, args, ctx: Context, info) {
        if (['Query', 'Mutation'].includes(typeName)) {
          if (!ctx.userId) {
            throw new AuthenticationError(
              'Access denied! You need to be authorized to perform this action!',
            );
          }

          await assertContributionEligible({
            con: ctx.con.manager,
            userId: ctx.userId,
            region: ctx.region,
          });
        }

        return resolve(source, args, ctx, info);
      };

      return fieldConfig;
    },
  });
