import { merge } from 'lodash';

import * as common from './schema/common';
import * as comments from './schema/comments';
import * as compatibility from './schema/compatibility';
import * as bookmarks from './schema/bookmarks';
import * as feed from './schema/feeds';
import * as integrations from './schema/integrations';
import * as notifications from './schema/notifications';
import * as posts from './schema/posts';
import * as settings from './schema/settings';
import * as submissions from './schema/submissions';
import * as sourceRequests from './schema/sourceRequests';
import * as sources from './schema/sources';
import * as tags from './schema/tags';
import * as users from './schema/users';
import * as alerts from './schema/alerts';
import * as actions from './schema/actions';
import * as search from './schema/search';
import * as keywords from './schema/keywords';
import * as devcards from './schema/devcards';
import * as authDirective from './directive/auth';
import * as urlDirective from './directive/url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  rateLimitDirectiveTransformer,
  rateLimitDirectiveTypeDefs,
} from './directive/rateLimit';

export const schema = urlDirective.transformer(
  authDirective.transformer(
    rateLimitDirectiveTransformer(
      makeExecutableSchema({
        typeDefs: [
          rateLimitDirectiveTypeDefs,
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
          submissions.typeDefs,
          actions.typeDefs,
          search.typeDefs,
          devcards.typeDefs,
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
          submissions.resolvers,
          actions.resolvers,
          search.resolvers,
          devcards.resolvers,
        ),
      }),
    ),
  ),
);
