import { IResolvers } from '@graphql-tools/utils';

import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { getShortUrl, isValidHttpUrl } from '../common';
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
    ): String
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
    getShortUrl: async (
      source,
      { url }: { url: string },
      ctx: Context,
    ): Promise<string> => {
      if (!isValidHttpUrl(url)) {
        throw new ValidationError('Invalid url');
      }

      const result = await getShortUrl(url, ctx.log);
      return result;
    },
  }),
};
