import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Integration } from '../entity';

interface GQLIntegration {
  logo: string;
  title: string;
  subtitle: string;
  url: string;
}

export const typeDefs = /* GraphQL */ `
  """
  Integration tutorials and walkthroughs
  """
  type Integration {
    logo: String!
    title: String!
    subtitle: String!
    url: String!
  }

  extend type Query {
    """
    Get the most popular integrations
    """
    popularIntegrations: [Integration!]! @cacheControl(maxAge: 600)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    popularIntegrations: async (source, args, ctx): Promise<GQLIntegration[]> =>
      ctx.getRepository(Integration).find({ order: { timestamp: 'DESC' } }),
  },
});
