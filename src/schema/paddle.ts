import type { CountryCode } from '@paddle/paddle-node-sdk';
import type { AuthContext } from '../Context';
import {
  coreProductCustomDataSchema,
  getPriceFromPaddleItem,
  paddleInstance,
} from '../common/paddle';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { SubscriptionCycles } from '../paddle';
import { getUserGrowthBookInstace } from '../growthbook';
import { User } from '../entity';
import { remoteConfig } from '../remoteConfig';
import { getCurrencySymbol, ONE_HOUR_IN_SECONDS } from '../common';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { getRedisObject, setRedisObjectWithExpiry } from '../redis';

export const typeDefs = /* GraphQL */ `
  """
  Price amounts
  """
  type PriceAmounts {
    """
    Price amount
    """
    amount: Float!
    """
    Formatted price
    """
    formatted: String!
    """
    Monthly price amount
    """
    monthlyAmount: Float!
    """
    Formatted monthly price
    """
    monthlyFormatted: String
  }

  """
  Trial period
  """
  type TrialPeriod {
    """
    Trial period
    """
    interval: String
    """
    Trial period unit
    """
    frequency: Int
  }

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
    price: PriceAmounts!
    """
    Three letter currency code (e.g. USD, EUR)
    """
    currencyCode: String
    """
    Currency symbol
    """
    currencySymbol: String
    """
    Optional additional label text
    """
    extraLabel: String
    """
    Apps id
    """
    appsId: String!
    """
    Subscription duration
    """
    duration: String!
    """
    Trial period
    """
    trialPeriod: TrialPeriod

    """
    Number of cores
    """
    coresValue: Int
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
    corePricePreviews: PricePreviews! @auth
  }
`;

export interface GQLCustomData {
  appsId: string;
  label: string;
}

export const resolvers: IResolvers<unknown, AuthContext> = traceResolvers<
  unknown,
  AuthContext
>({
  Query: {
    pricePreviews: async (_, __, ctx: AuthContext) => {
      const region = ctx.region;

      const user = await ctx.con.getRepository(User).findOneOrFail({
        where: { id: ctx.userId },
        select: {
          createdAt: true,
        },
      });

      const growthbookClient = getUserGrowthBookInstace(ctx.userId, {
        enableDevMode: process.env.NODE_ENV !== 'production',
        subscribeToChanges: false,
        attributes: {
          registrationDate: user.createdAt.toISOString(),
        },
      });

      const featureValue: Record<string, string> =
        growthbookClient.getFeatureValue('pricing_ids', {});

      const pricePreview = await paddleInstance?.pricingPreview.preview({
        items: Object.keys(featureValue).map((priceId) => ({
          priceId,
          quantity: 1,
        })),
        address: region ? { countryCode: region as CountryCode } : undefined,
      });

      const items = pricePreview?.details?.lineItems.map((item) => {
        const isOneOff = !item.price?.billingCycle?.interval;
        const isYearly = item.price?.billingCycle?.interval === 'year';
        const duration =
          isOneOff || isYearly
            ? SubscriptionCycles.Yearly
            : SubscriptionCycles.Monthly;
        const priceAmount = getPriceFromPaddleItem(item);
        const months = duration === SubscriptionCycles.Yearly ? 12 : 1;
        const monthlyPrice = Number(
          (priceAmount / months).toString().match(/^-?\d+(?:\.\d{0,2})?/)?.[0],
        );
        const currencyCode = pricePreview?.currencyCode;
        const currencySymbol = item.formattedTotals.total.replace(
          /\d|\.|\s|,/g,
          '',
        );
        const customData = item.price.customData as GQLCustomData;
        const priceFormatter = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
        });

        return {
          label: item.price.name,
          value: item.price.id,
          price: {
            amount: priceAmount,
            formatted: item.formattedTotals.total,
            monthlyAmount: monthlyPrice,
            monthlyFormatted: `${currencySymbol}${priceFormatter.format(
              monthlyPrice,
            )}`,
          },
          currencyCode,
          currencySymbol,
          extraLabel: customData?.label,
          appsId: customData?.appsId ?? 'default',
          duration,
          trialPeriod: item.price.trialPeriod,
        };
      });

      return {
        currencyCode: pricePreview?.currencyCode as string,
        items,
      };
    },
    corePricePreviews: async (_, __, ctx: AuthContext) => {
      const region = ctx.region;

      const corePaddleProductId = remoteConfig.vars.coreProductId;

      const redisKey = generateStorageKey(
        StorageTopic.Paddle,
        StorageKey.PricingPreview,
        JSON.stringify({ productId: corePaddleProductId, region }),
      );

      const redisResult = await getRedisObject(redisKey);

      if (redisResult) {
        const cachedResult = JSON.parse(redisResult);

        return cachedResult;
      }

      if (!corePaddleProductId) {
        throw new Error('Core product id is not set in remote config');
      }

      const paddleProduct = await paddleInstance?.products.get(
        corePaddleProductId,
        {
          include: ['prices'],
        },
      );

      const pricePreview = await paddleInstance?.pricingPreview.preview({
        items: (paddleProduct.prices || [])
          .filter((item) => item.status === 'active')
          .map((price) => ({
            priceId: price.id,
            quantity: 1,
          })),
        address: region ? { countryCode: region as CountryCode } : undefined,
      });

      const items = pricePreview.details.lineItems.map((item) => {
        const currencyCode = pricePreview?.currencyCode;
        const currencySymbol = getCurrencySymbol({
          locale: 'en-US',
          currency: currencyCode,
        });
        const customData = coreProductCustomDataSchema.parse(
          item.price.customData,
        );

        return {
          label: item.price.name,
          value: item.price.id,
          price: {
            amount: item.price.unitPrice.amount,
            formatted: item.formattedTotals.total,
            // just for current schema compatibility
            monthlyAmount: item.price.unitPrice.amount,
            monthlyFormatted: item.formattedTotals.total,
          },
          currencyCode,
          currencySymbol,
          appsId: 'cores',
          duration: 'one-time',
          trialPeriod: null,
          coresValue: customData.cores,
        };
      });
      items.sort((a, b) => a.coresValue - b.coresValue);

      const result = {
        currencyCode: pricePreview?.currencyCode as string,
        items,
      };

      const expirationSeconds = 1 * ONE_HOUR_IN_SECONDS;

      await setRedisObjectWithExpiry(
        redisKey,
        JSON.stringify(result),
        expirationSeconds,
      );

      return result;
    },
  },
});
