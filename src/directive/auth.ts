import { ForbiddenError, AuthenticationError } from 'apollo-server-errors';
import { defaultFieldResolver, GraphQLScalarType } from 'graphql';
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
        typeDirectiveArgumentMaps[type.name] = args;
      }
      return undefined;
    },
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const args =
        getDirective(schema, fieldConfig, directiveName)?.[0] ??
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
              if (fieldConfig.type instanceof GraphQLScalarType) {
                resolve(source, args, ctx, info);
                return null;
              }

              throw new AuthenticationError(
                'Access denied! You need to be authorized to perform this action!',
              );
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
                if (fieldConfig.type instanceof GraphQLScalarType) {
                  resolve(source, args, ctx, info);
                  return null;
                }

                throw new ForbiddenError(
                  'Access denied! You do not have permission for this action!',
                );
              }
            }
            return resolve(source, args, ctx, info);
          };
        }
        return fieldConfig;
      }
    },
  });
