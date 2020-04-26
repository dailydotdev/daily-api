import { GraphQLFormattedError } from 'graphql';
import { ApolloServer, Config } from 'apollo-server-fastify';
import { buildSchema } from 'type-graphql';
import { snakeCase } from 'snake-case';
import {
  NotificationResolver,
  SourceRequestResolver,
  SourceResolver,
} from './resolver';
import { ResolverTracing } from './middleware';
import { authChecker } from './authChecker';

export default async function (config: Config): Promise<ApolloServer> {
  const schema = await buildSchema({
    resolvers: [NotificationResolver, SourceResolver, SourceRequestResolver],
    emitSchemaFile: !process.env.NODE_ENV,
    globalMiddlewares: [ResolverTracing],
    authChecker,
  });
  return new ApolloServer({
    schema,
    ...config,
    uploads: false,
    formatError: (error): GraphQLFormattedError => {
      if (error.originalError.name === 'Error') {
        if (
          error.originalError.message ===
            'Access denied! You need to be authorized to perform this action!' ||
          error.originalError.message ===
            "Access denied! You don't have permission for this action!"
        ) {
          error.extensions.code = 'UNAUTHORIZED_ERROR';
        } else if (error.extensions?.exception?.validationErrors) {
          error.extensions.code = 'VALIDATION_ERROR';
        }
      } else if (error.originalError.name === 'EntityNotFound') {
        error.extensions.code = 'NOT_FOUND_ERROR';
      } else {
        error.extensions.code = snakeCase(
          error.originalError.name,
        ).toUpperCase();
      }
      return error;
    },
  });
}
