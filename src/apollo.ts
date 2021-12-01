import { merge } from 'lodash';
import { GraphQLFormattedError } from 'graphql';
import { ApolloServer, Config } from 'apollo-server-fastify';
import { ApolloErrorConverter } from 'apollo-error-converter';
import { ApolloServerPluginCacheControl } from 'apollo-server-core';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';

import * as common from './schema/common';
import * as comments from './schema/comments';
import * as compatibility from './schema/compatibility';
import * as bookmarks from './schema/bookmarks';
import * as feed from './schema/feeds';
import * as integrations from './schema/integrations';
import * as notifications from './schema/notifications';
import * as posts from './schema/posts';
import * as settings from './schema/settings';
import * as sourceRequests from './schema/sourceRequests';
import * as sources from './schema/sources';
import * as tags from './schema/tags';
import * as users from './schema/users';
import * as alerts from './schema/alerts';
import * as keywords from './schema/keywords';
import * as authDirective from './directive/auth';
import * as urlDirective from './directive/url';
import { makeExecutableSchema } from 'graphql-tools';
import { FastifyInstance } from 'fastify';

const errorConverter = new ApolloErrorConverter({
  errorMap: {
    EntityNotFound: {
      code: 'NOT_FOUND',
      message: 'Entity not found',
    },
  },
});

function fastifyAppClosePlugin(app?: FastifyInstance): ApolloServerPlugin {
  return {
    async serverWillStart() {
      return {
        async drainServer() {
          if (app) {
            await app.close();
          }
        },
      };
    },
  };
}

export default async function (
  config: Config,
  app?: FastifyInstance,
): Promise<ApolloServer> {
  return new ApolloServer({
    schema: urlDirective.transformer(
      authDirective.transformer(
        makeExecutableSchema({
          typeDefs: [
            common.typeDefs,
            urlDirective.typeDefs,
            authDirective.typeDefs,
            comments.typeDefs,
            compatibility.typeDefs,
            bookmarks.typeDefs,
            feed.typeDefs,
            integrations.typeDefs,
            notifications.typeDefs,
            posts.typeDefs,
            settings.typeDefs,
            sourceRequests.typeDefs,
            sources.typeDefs,
            tags.typeDefs,
            users.typeDefs,
            keywords.typeDefs,
            alerts.typeDefs,
          ],
          resolvers: merge(
            common.resolvers,
            comments.resolvers,
            compatibility.resolvers,
            bookmarks.resolvers,
            feed.resolvers,
            integrations.resolvers,
            notifications.resolvers,
            posts.resolvers,
            settings.resolvers,
            sourceRequests.resolvers,
            sources.resolvers,
            tags.resolvers,
            users.resolvers,
            keywords.resolvers,
            alerts.resolvers,
          ),
        }),
      ),
    ),
    // Workaround due to wrong typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [ApolloServerPluginCacheControl(), fastifyAppClosePlugin(app)],
    // uploads: {
    //   maxFileSize: 1024 * 1024 * 2,
    // },
    // subscriptions:
    //   process.env.ENABLE_SUBSCRIPTIONS === 'true'
    //     ? {
    //         onConnect: (connectionParams, websocket) => ({
    //           req: (websocket as Record<string, unknown>).upgradeReq,
    //         }),
    //       }
    //     : false,
    formatError: (error): GraphQLFormattedError => {
      if (
        process.env.NODE_ENV === 'development' ||
        error?.message === 'PersistedQueryNotFound' ||
        !error?.originalError
      ) {
        return error;
      }
      return errorConverter(error);
    },
    ...config,
  });
}
