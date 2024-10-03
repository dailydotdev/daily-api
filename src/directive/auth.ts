import { ForbiddenError, AuthenticationError } from 'apollo-server-errors';
import { defaultFieldResolver } from 'graphql';
import { GraphQLSchema } from 'graphql';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { Context } from '../Context';

const directiveName = 'auth';

export const typeDefs = /* GraphQL */ `
directive @${directiveName}(
  """
  Roles required for the operation (at least one)
  """
  requires: [Role] = []

  """
  Whether premium subscription is required
  """
  premium: Boolean = false
) on OBJECT | FIELD_DEFINITION

enum Role {
  MODERATOR
}
`;

const typeDirectiveArgumentMaps: { requires?: string[]; premium?: boolean } =
  {};

export const transformer = (schema: GraphQLSchema): GraphQLSchema =>
  mapSchema(schema, {
    [MapperKind.TYPE]: (type) => {
      const args = getDirective(schema, type, directiveName)?.[0];
      if (args) {
        // @ts-expect-error - internal mapping
        typeDirectiveArgumentMaps[type.name] = args;
      }
      return undefined;
    },
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const args =
        getDirective(schema, fieldConfig, directiveName)?.[0] ??
        // @ts-expect-error - internal mapping
        typeDirectiveArgumentMaps[typeName];
      if (args) {
        const { requires, premium } = args;
        if (requires) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          fieldConfig.resolve = function (source, args, ctx: Context, info) {
            if (!requires && !premium) {
              return resolve(source, args, ctx, info);
            }
            if (!ctx.userId) {
              if (['Query', 'Mutation'].includes(typeName)) {
                throw new AuthenticationError(
                  'Access denied! You need to be authorized to perform this action!',
                );
              }

              resolve(source, args, ctx, info);
              return null;
            }
            if (requires.length > 0 || premium) {
              let authorized: boolean;
              if (premium) {
                authorized = ctx.premium;
              } else {
                const roles = ctx.roles;
                authorized =
                  roles.findIndex(
                    (r) => requires.indexOf(r.toUpperCase()) > -1,
                  ) > -1;
              }
              if (!authorized) {
                if (['Query', 'Mutation'].includes(typeName)) {
                  throw new ForbiddenError(
                    'Access denied! You do not have permission for this action!',
                  );
                }

                resolve(source, args, ctx, info);
                return null;
              }
            }
            return resolve(source, args, ctx, info);
          };
        }
        return fieldConfig;
      }
    },
  });
