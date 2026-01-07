import { IResolvers } from '@graphql-tools/utils';
import { omitBy, isEmpty } from 'lodash';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';

import { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { DevCardTheme, DevCard } from '../entity';
import { NotFoundError } from '../errors';
import { DevCardData, getDevCardData } from '../common/devcard';
import { isValidHttpUrl, uploadDevCardBackground } from '../common';
import { ValidationError } from 'apollo-server-errors';

export interface GQLDevCard {
  id: string;
  userId: string;
  createdAt: Date;
  theme: DevCardTheme;
  isProfileCover: boolean;
  showBorder: boolean;
}

export const typeDefs = /* GraphQL */ `
  type DevCard {
    imageUrl: String!
  }

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
    generateDevCard(file: Upload, url: String): DevCard @auth

    """
    Generates or updates the user's Dev Card preferences
    """
    generateDevCardV2(
      theme: DevCardTheme
      type: DevCardType
      isProfileCover: Boolean
      showBorder: Boolean
    ): DevCardImage @auth
  }
`;

interface GenerateDevCardInput extends Pick<
  DevCard,
  'theme' | 'isProfileCover' | 'showBorder'
> {
  type: 'DEFAULT' | 'WIDE' | 'X';
}

interface DevCardByIdResult extends Omit<DevCard, 'user'>, DevCardData {}

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    devCard: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<DevCardByIdResult> => {
      const repo = ctx.con.getRepository(DevCard);
      let res = await repo.findOneBy({ userId: id });
      if (res == null) {
        try {
          // create devcard row if none found
          res = await repo.save({
            userId: id,
          });
        } catch (e) {
          throw new NotFoundError('DevCard not found');
        }
      }

      const data = await getDevCardData(id, ctx.con);
      return { ...res, ...data };
    },
  },
  Mutation: {
    generateDevCard: async (
      source,
      { file, url }: { file?: FileUpload; url: string },
      ctx: AuthContext,
    ): Promise<{ imageUrl: string }> => {
      const repo = ctx.con.getRepository(DevCard);
      let devCard: DevCard | null = await repo.findOneBy({
        userId: ctx.userId,
      });
      if (!devCard) {
        devCard = await repo.save({ userId: ctx.userId });
      } else if (!file && !url) {
        await repo.update(devCard.id, { background: null });
      }
      if (file) {
        const { createReadStream } = await file;
        const stream = createReadStream();
        const { url: backgroundImage } = await uploadDevCardBackground(
          devCard.id,
          stream,
        );
        await repo.update(devCard.id, { background: backgroundImage });
      } else if (url) {
        if (!isValidHttpUrl(url)) {
          throw new ValidationError('Invalid url');
        }
        await repo.update(devCard.id, { background: url });
      }
      // Avoid caching issues with the new version
      const randomStr = Math.random().toString(36).substring(2, 5);
      return {
        imageUrl: `${process.env.URL_PREFIX}/devcards/${devCard.id.replace(
          /-/g,
          '',
        )}.png?r=${randomStr}`,
      };
    },
    generateDevCardV2: async (
      source,
      { theme, isProfileCover, showBorder, type }: GenerateDevCardInput,
      ctx: AuthContext,
    ): Promise<{ imageUrl: string }> => {
      const repo = ctx.con.getRepository(DevCard);
      let devCard: DevCard | null = await repo.findOneBy({
        userId: ctx.userId,
      });
      devCard = await repo.save({
        id: devCard === null ? undefined : devCard.id,
        userId: ctx.userId,
        theme: theme?.toLocaleLowerCase() as DevCardTheme | undefined,
        isProfileCover,
        showBorder,
      });

      // Avoid caching issues when devcard is generated again
      const randomStr = Math.random().toString(36).substring(2, 5);
      const queryStr = new URLSearchParams(
        omitBy(
          {
            type: type?.toLocaleLowerCase(),
            r: randomStr,
          },
          isEmpty,
        ),
      ).toString();
      const url = new URL(
        `/devcards/v2/${devCard.userId}.png`,
        process.env.URL_PREFIX,
      );
      url.search = queryStr;

      return {
        imageUrl: url.toString(),
      };
    },
  },
});
