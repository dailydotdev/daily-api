import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context } from '../Context';
import { toGQLEnum } from '../common/utils';
import graphorm from '../graphorm';
import {
  SpotlightAction,
  SpotlightActionGroup,
  SpotlightActionKind,
} from '../entity/SpotlightAction';

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(SpotlightActionGroup, 'SpotlightActionGroup')}
  ${toGQLEnum(SpotlightActionKind, 'SpotlightActionKind')}

  type SpotlightAction {
    id: String!
    group: SpotlightActionGroup!
    title: String!
    subtitle: String
    icon: String!
    keywords: [String!]!
    shortcut: String
    quickKey: String
    requiresAuth: Boolean
    requiresPlus: Boolean
    platforms: [String!]
    kind: SpotlightActionKind!
    payload: JSONObject!
  }

  extend type Query {
    """
    Returns the active catalog of Spotlight command-palette actions. Filtering
    by user state (auth, Plus, platform) is done client-side using the
    requiresAuth / requiresPlus / platforms fields.
    """
    spotlightActions: [SpotlightAction!]!
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    spotlightActions: async (
      _,
      __,
      ctx: Context,
      info,
    ): Promise<SpotlightAction[]> =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."active" = true`)
            .orderBy(`"${builder.alias}"."group"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."priority"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."id"`, 'ASC');
          return builder;
        },
        true,
      ),
  },
};
