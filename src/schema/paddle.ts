import type { CountryCode } from '@paddle/paddle-node-sdk';
import type { BaseContext } from '../Context';
import { paddleInstance } from '../common/paddle';
import { remoteConfig } from '../remoteConfig';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';

export const typeDefs = /* GraphQL */ `
  """
  Price details for a product
  """
  type Price {
    """
    Label of the price
    """
    label: String!
    """
    Id of the price
    """
    value: String!
    """
    Formatted price with currency symbol
    """
    price: String!
    """
    Raw unformatted price value
    """
    priceUnformatted: String!
    """
    Three letter currency code (e.g. USD, EUR)
    """
    currencyCode: String!
    """
    Optional additional label text
    """
    extraLabel: String
    """
    Apps id
    """
    appsId: String
  }

  """
  Price previews
  """
  type PricePreviews {
    """
    Three letter currency code
    """
    currencyCode: String!
    """
    Price previews
    """
    items: [Price!]!
  }

  extend type Query {
    pricePreviews: PricePreviews! @auth
  }
`;

export interface GQLCustomData {
  appsId: string;
  label: string;
}

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    pricePreviews: async (_, __, ctx: BaseContext) => {
      const region = ctx.region;

      const pricePreview = await paddleInstance?.pricingPreview.preview({
        items: Object.keys(remoteConfig.vars?.pricingIds || {}).map(
          (priceId) => ({
            priceId,
            quantity: 1,
          }),
        ),
        address: region ? { countryCode: region as CountryCode } : undefined,
      });

      const items = pricePreview?.details?.lineItems.map((item) => ({
        label: item.price.description,
        value: item.price.id,
        price: item.formattedTotals.total,
        priceUnformatted: Number(item.totals.total),
        currencyCode: pricePreview?.currencyCode as string,
        extraLabel: (item.price.customData as GQLCustomData)?.label,
        appsId: (item.price.customData as GQLCustomData)?.appsId,
      }));

      return {
        currencyCode: pricePreview?.currencyCode as string,
        items,
      };
    },
  },
});
