import { merge } from 'lodash';
import { ApolloServer, Config } from 'apollo-server-fastify';
import { ApolloErrorConverter } from 'apollo-error-converter';

import * as common from './schema/common';
import * as compatibility from './schema/compatibility';
import * as bookmarks from './schema/bookmarks';
import * as feed from './schema/feeds';
import * as notifications from './schema/notifications';
import * as posts from './schema/posts';
import * as settings from './schema/settings';
import * as sourceRequests from './schema/sourceRequests';
import * as sources from './schema/sources';
import * as tags from './schema/tags';
import { AuthDirective, UrlDirective } from './directive';

export default async function (config: Config): Promise<ApolloServer> {
  return new ApolloServer({
    typeDefs: [
      common.typeDefs,
      compatibility.typeDefs,
      bookmarks.typeDefs,
      feed.typeDefs,
      notifications.typeDefs,
      posts.typeDefs,
      settings.typeDefs,
      sourceRequests.typeDefs,
      sources.typeDefs,
      tags.typeDefs,
    ],
    resolvers: merge(
      common.resolvers,
      compatibility.resolvers,
      bookmarks.resolvers,
      feed.resolvers,
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
    ...config,
    uploads: true,
    formatError: new ApolloErrorConverter({
      errorMap: {
        EntityNotFound: {
          code: 'NOT_FOUND',
          message: 'Entity not found',
        },
      },
    }),
  });
}
