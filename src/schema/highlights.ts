import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context } from '../Context';
import graphorm from '../graphorm';

export const typeDefs = /* GraphQL */ `
  type PostHighlight {
    id: ID!
    post: Post!
    channel: String!
    highlightedAt: DateTime!
    headline: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    """
    Get highlights for a channel, ordered by recency
    """
    postHighlights(channel: String!): [PostHighlight!]!
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    postHighlights: async (_, args: { channel: string }, ctx: Context, info) =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."channel" = :channel`, {
              channel: args.channel,
            })
            .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC');
          return builder;
        },
        true,
      ),
  },
};
