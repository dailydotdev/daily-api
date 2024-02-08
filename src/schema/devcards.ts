import { IResolvers } from '@graphql-tools/utils';
import { omitBy, isEmpty } from 'lodash';

import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { DevCardTheme, DevCard } from '../entity';
import { NotFoundError } from '../errors';
import { DevCardData, getDevCardData } from '../common/devcard';

export interface GQLDevCard {
  id: string;
  userId: string;
  createdAt: Date;
  theme: DevCardTheme;
  isProfileCover: boolean;
  showBorder: boolean;
}

export const typeDefs = /* GraphQL */ `
  """
  Defines available themes for dev cards
  """
  enum DevCardTheme {
    DEFAULT
    IRON
    BRONZE
    SILVER
    GOLD
    PLATINUM
    DIAMOND
    LEGENDARY
  }

  """
  Determines which devcard image to generate - default, wide or the twitter/X one
  """
  enum DevCardType {
    DEFAULT
    WIDE
    X
  }

  """
  Dev card
  """
  type DevCardData {
    """
    ID of the dev card
    """
    id: String!

    """
    The user that dev card belongs to
    """
    user: User!

    """
    Timestamp the dev card was created
    """
    createdAt: DateTime!

    """
    Theme of the dev card
    """
    theme: String!

    """
    Whether the dev card cover is from the profile, default false
    """
    isProfileCover: Boolean!

    """
    Whether the dev card has a border, default true
    """
    showBorder: Boolean!

    """
    Number of articles read
    """
    articlesRead: Int!

    """
    Tags
    """
    tags: [String!]!

    """
    Sources logo image URLs
    """
    sources: [Source!]!
  }

  """
  The type returned on generateDevCard mutation
  """
  type DevCardImage {
    imageUrl: String!
  }

  extend type Query {
    """
    Get devcard by id
    """
    devCard(
      """
      Id of the requested devcard
      """
      id: ID
    ): DevCardData!
  }

  extend type Mutation {
    """
    Generates or updates the user's Dev Card preferences
    """
    generateDevCard(
      theme: DevCardTheme
      type: DevCardType
      isProfileCover: Boolean
      showBorder: Boolean
    ): DevCardImage @auth
  }
`;

interface GenerateDevCardInput
  extends Pick<DevCard, 'theme' | 'isProfileCover' | 'showBorder'> {
  type: 'DEFAULT' | 'WIDE' | 'X';
}

interface DevCardByIdResult extends Omit<DevCard, 'user'>, DevCardData {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
    devCard: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<DevCardByIdResult> => {
      const res = await ctx.con
        .getRepository(DevCard)
        .findOneBy({ userId: id });
      if (res !== null) {
        const data = await getDevCardData(id, ctx.con);
        return { ...res, ...data };
      }
      throw new NotFoundError('DevCard not found');
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    generateDevCard: async (
      source,
      { theme, isProfileCover, showBorder, type }: GenerateDevCardInput,
      ctx: Context,
    ): Promise<{ imageUrl: string }> => {
      const repo = ctx.con.getRepository(DevCard);
      let devCard: DevCard = await repo.findOneBy({ userId: ctx.userId });
      if (!devCard) {
        devCard = await repo.save({
          userId: ctx.userId,
          theme: theme?.toLocaleLowerCase() as DevCardTheme | undefined,
          isProfileCover,
          showBorder,
        });
      }

      // Avoid caching issues when devcard is generated again
      const randomStr = Math.random().toString(36).substring(2, 5);
      const queryStr = new URLSearchParams(
        omitBy(
          {
            type,
            r: randomStr,
          },
          isEmpty,
        ),
      ).toString();
      const url = new URL(
        `/devcards/${devCard.userId}.png`,
        process.env.OG_URL,
      );
      url.search = queryStr;

      return {
        imageUrl: url.toString(),
      };
    },
  }),
};
