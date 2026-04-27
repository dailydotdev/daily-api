import { IResolvers } from '@graphql-tools/utils';
import type { z } from 'zod';
import type { AuthContext, BaseContext } from '../Context';
import { onboardingDiscoverPostsInputSchema } from '../common/schema/onboardingDiscoverPosts';
import { ServiceError } from '../errors';
import { recswipeClient } from '../integrations/recswipe/clients';
import { HttpError } from '../integrations/retry';

type OnboardingDiscoverPostsArgs = Partial<
  z.input<typeof onboardingDiscoverPostsInputSchema>
>;

export const typeDefs = /* GraphQL */ `
  """
  Lightweight post info returned by the onboarding swipe recommender.
  Use feedByIds to hydrate into full Post objects.
  """
  type OnboardingSwipePost {
    postId: String!
    title: String!
    summary: String!
    tags: [String!]!
  }

  type OnboardingDiscoverPostsResult {
    posts: [OnboardingSwipePost!]!
    subPrompts: [String!]!
  }

  extend type Mutation {
    """
    Discover candidate posts for the Tinder-style swipe onboarding deck.
    Stateless proxy to the recswipe service that returns lightweight post
    summaries; clients should hydrate via feedByIds.
    """
    onboardingDiscoverPosts(
      prompt: String
      selectedTags: [String!]
      confirmedTags: [String!]
      likedTitles: [String!]
      excludeIds: [String!]
      saturatedTags: [String!]
      n: Int
    ): OnboardingDiscoverPostsResult! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Mutation: {
    onboardingDiscoverPosts: async (
      _,
      args: OnboardingDiscoverPostsArgs,
      ctx: AuthContext,
    ) => {
      const parsed = onboardingDiscoverPostsInputSchema.parse(args);

      try {
        const data = await recswipeClient.discoverPosts(ctx.userId, parsed);

        return {
          posts: (data.posts ?? []).map((p) => ({
            postId: p.post_id,
            title: p.title,
            summary: p.summary,
            tags: p.tags ?? [],
          })),
          subPrompts: data.sub_prompts ?? [],
        };
      } catch (err) {
        if (err instanceof HttpError) {
          throw new ServiceError({
            message: 'Recswipe discoverPosts request failed',
            data: err.response,
            statusCode: err.statusCode,
          });
        }

        throw err;
      }
    },
  },
};
