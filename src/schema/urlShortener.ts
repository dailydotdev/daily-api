import { IResolvers } from '@graphql-tools/utils';

import { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { getShortUrl, isValidHttpUrl, isAllowedShortenerUrl } from '../common';
import { ValidationError } from 'apollo-server-errors';

export const typeDefs = /* GraphQL */ `
  extend type Query {
    """
    Shorten URL using daily.dev URL shortener
    """
    getShortUrl(
      """
      Url to shorten
      """
      url: String!
    ): String @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    getShortUrl: async (
      source,
      { url }: { url: string },
      ctx: AuthContext,
    ): Promise<string> => {
      if (!isValidHttpUrl(url) || !isAllowedShortenerUrl(url)) {
        throw new ValidationError('Invalid url');
      }

      const result = await getShortUrl(url, ctx.log);
      return result;
    },
  },
});
