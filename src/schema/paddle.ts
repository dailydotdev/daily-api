import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { BaseContext } from '../Context';
import { remoteConfig } from '../remoteConfig';

type PricingId = {
  value: string;
};
export const typeDefs = /* GraphQL */ `
  """
  Pricing ids available
  """
  type PricingId {
    """
    JSON encoded value for pricing ids
    """
    value: String!
  }

  extend type Query {
    """
    Get the current available pricing options
    """
    pricingIds: PricingId!
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    pricingIds: (): PricingId => {
      return {
        value: JSON.stringify(remoteConfig.vars?.pricingIds),
      };
    },
  },
});
