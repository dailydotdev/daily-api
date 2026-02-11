import { merge } from 'lodash';

import * as common from './schema/common';
import * as comments from './schema/comments';
import * as compatibility from './schema/compatibility';
import * as bookmarks from './schema/bookmarks';
import * as feed from './schema/feeds';
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
import * as urlShortener from './schema/urlShortener';
import * as authDirective from './directive/auth';
import * as feedPlusDirective from './directive/feedPlus';
import * as urlDirective from './directive/url';
import * as leaderboard from './schema/leaderboard';
import * as integrations from './schema/integrations';
import * as contentPreference from './schema/contentPreference';
import * as prompts from './schema/prompts';
import * as paddle from './schema/paddle';
import * as njord from './schema/njord';
import * as organizations from './schema/organizations';
import * as campaigns from './schema/campaigns';
import * as opportunity from './schema/opportunity';
import * as autocompletes from './schema/autocompletes';
import * as profile from './schema/profile';
import * as userStack from './schema/userStack';
import * as sourceStack from './schema/sourceStack';
import * as userHotTake from './schema/userHotTake';
import * as gear from './schema/gear';
import * as userWorkspacePhoto from './schema/userWorkspacePhoto';
import * as personalAccessTokens from './schema/personalAccessTokens';
import * as feedback from './schema/feedback';
import * as achievements from './schema/achievements';
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  rateLimitTypeDefs,
  rateLimiterTransformers,
} from './directive/rateLimit';
import * as rateLimitCounterDirective from './directive/rateLimitCounter';

export const schema = urlDirective.transformer(
  feedPlusDirective.transformer(
    rateLimitCounterDirective.transformer(
      authDirective.transformer(
        rateLimiterTransformers(
          makeExecutableSchema({
            typeDefs: [
              ...rateLimitTypeDefs,
              common.typeDefs,
              urlDirective.typeDefs,
              feedPlusDirective.typeDefs,
              rateLimitCounterDirective.typeDefs,
              authDirective.typeDefs,
              comments.typeDefs,
              compatibility.typeDefs,
              bookmarks.typeDefs,
              feed.typeDefs,
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
              urlShortener.typeDefs,
              leaderboard.typeDefs,
              integrations.typeDefs,
              contentPreference.typeDefs,
              prompts.typeDefs,
              paddle.typeDefs,
              njord.typeDefs,
              organizations.typeDefs,
              campaigns.typeDefs,
              opportunity.typeDefs,
              autocompletes.typeDefs,
              profile.typeDefs,
              userStack.typeDefs,
              sourceStack.typeDefs,
              userHotTake.typeDefs,
              gear.typeDefs,
              userWorkspacePhoto.typeDefs,
              personalAccessTokens.typeDefs,
              feedback.typeDefs,
              achievements.typeDefs,
            ],
            resolvers: merge(
              common.resolvers,
              comments.resolvers,
              compatibility.resolvers,
              bookmarks.resolvers,
              feed.resolvers,
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
              urlShortener.resolvers,
              leaderboard.resolvers,
              integrations.resolvers,
              contentPreference.resolvers,
              prompts.resolvers,
              paddle.resolvers,
              njord.resolvers,
              organizations.resolvers,
              campaigns.resolvers,
              opportunity.resolvers,
              autocompletes.resolvers,
              profile.resolvers,
              userStack.resolvers,
              sourceStack.resolvers,
              userHotTake.resolvers,
              gear.resolvers,
              userWorkspacePhoto.resolvers,
              personalAccessTokens.resolvers,
              feedback.resolvers,
              achievements.resolvers,
            ),
          }),
        ),
      ),
    ),
  ),
);
