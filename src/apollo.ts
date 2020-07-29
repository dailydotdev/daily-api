import { merge } from 'lodash';
import { GraphQLFormattedError } from 'graphql';
import { ApolloServer, Config } from 'apollo-server-fastify';
import { ApolloErrorConverter } from 'apollo-error-converter';
import responseCachePlugin from 'apollo-server-plugin-response-cache';

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
import { AuthDirective, UrlDirective } from './directive';

const errorConverter = new ApolloErrorConverter({
  errorMap: {
    EntityNotFound: {
      code: 'NOT_FOUND',
      message: 'Entity not found',
    },
  },
});

export default async function (config: Config): Promise<ApolloServer> {
  return new ApolloServer({
    typeDefs: [
      common.typeDefs,
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
    ),
    schemaDirectives: {
      auth: AuthDirective,
      url: UrlDirective,
    },
    // Workaround due to wrong typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [(responseCachePlugin as any)()],
    uploads: true,
    subscriptions: false,
    formatError: (error): GraphQLFormattedError => {
      if (error?.message === 'PersistedQueryNotFound') {
        return error;
      }
      return errorConverter(error);
    },
    ...config,
  });
}
