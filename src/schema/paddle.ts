import {
  getPricingDuration,
  getPricingMetadata,
  getPricingMetadataByPriceIds,
  getProductPrice,
} from './../common/paddle/pricing';
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
import { getUserGrowthBookInstance } from '../growthbook';
import { User } from '../entity';
import { remoteConfig } from '../remoteConfig';
import { getCurrencySymbol, ONE_HOUR_IN_SECONDS, toGQLEnum } from '../common';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { getRedisObject, setRedisObjectWithExpiry } from '../redis';
import {
  getPlusPricePreview,
  BasePricingMetadata,
  BasePricingPreview,
  removeNumbers,
} from '../common/paddle/pricing';
import { PricingPreview } from '@paddle/paddle-node-sdk/dist/types/entities/pricing-preview';
import { createHmac } from 'node:crypto';
import { ValidationError } from 'apollo-server-errors';
import { logger } from '../logger';
import { PurchaseType } from '../common/plus';

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
    pricingMetadata(type: PricingType): [ProductPricingMetadata!]! @auth
    pricingPreview(
      type: PricingType
      locale: String
      discountId: String
    ): [ProductPricingPreview!]!
    pricingPreviewByIds(
      """
      The IDs of the prices to preview
      """
      ids: [String]!

      """
      The locale to use for formatting prices
      """
      locale: String
      """
      Load metadata for the pricing previews
      """
      loadMetadata: Boolean
    ): [BaseProductPricingPreview!]!
  }

  ${toGQLEnum(PurchaseType, 'PricingType')}
  ${toGQLEnum(PurchaseType, 'PurchaseType')}

  """
  Caption information for pricing metadata
  """
  type PricingCaption {
    """
    Caption text
    """
    copy: String!
    """
    Caption color
    """
    color: String!
  }

  """
  ID mapping for different platforms
  """
  type PricingIdMap {
    """
    Paddle platform ID
    """
    paddle: String
    """
    iOS platform ID
    """
    ios: String
  }

  """
  Plus pricing metadata information
  """
  type ProductPricingMetadata {
    """
    Application ID
    """
    appsId: String
    """
    Title of the pricing option
    """
    title: String!
    """
    Optional caption information
    """
    caption: PricingCaption
    """
    Platform-specific IDs
    """
    idMap: PricingIdMap!
    """
    Number of cores
    """
    coresValue: Int
  }

  """
  Price preview information
  """
  type PricePreview {
    """
    Price amount
    """
    amount: Float!
    """
    Formatted price string
    """
    formatted: String!
  }

  type ProductPricePreview {
    """
    Price amount
    """
    amount: Float!
    """
    Formatted price string
    """
    formatted: String!
    """
    Monthly price information
    """
    monthly: PricePreview
    """
    Daily price information
    """
    daily: PricePreview
  }

  """
  Currency information
  """
  type Currency {
    """
    Three letter currency code
    """
    code: String!
    """
    Currency symbol
    """
    symbol: String
  }

  type BaseProductPricingPreview {
    """
    Price ID
    """
    priceId: String!
    """
    Price information
    """
    price: ProductPricePreview!
    """
    Currency information
    """
    currency: Currency!
    """
    Subscription duration
    """
    duration: String!
    """
    Trial period information
    """
    trialPeriod: TrialPeriod

    """
    Price metadata information
    """
    metadata: ProductPricingMetadata
  }

  """
  Extended pricing preview with additional information
  """
  type ProductPricingPreview {
    """
    Metadata information
    """
    metadata: ProductPricingMetadata!
    """
    Price ID
    """
    priceId: String!
    """
    Price information
    """
    price: ProductPricePreview!
    """
    Currency information
    """
    currency: Currency!
    """
    Subscription duration
    """
    duration: String!
    """
    Trial period information
    """
    trialPeriod: TrialPeriod
  }
`;

export interface GQLCustomData {
  appsId: string;
  label: string;
}

interface PaddlePricingPreviewArgs {
  type?: PurchaseType;
  locale?: string;
  discountId?: string;
}

interface PaddlePricingPreviewByIdsArgs {
  ids: string[];
  locale?: string;
  loadMetadata?: boolean;
}

type BasePricingWithoutMetadata = Omit<BasePricingPreview, 'metadata'>;

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

      const growthbookClient = getUserGrowthBookInstance(ctx.userId, {
        enableDevMode: process.env.NODE_ENV !== 'production',
        subscribeToChanges: false,
        attributes: {
          registrationDate: user.createdAt.toISOString(),
        },
      });

      const featureValue: Record<string, string> =
        growthbookClient.getFeatureValue('pricing_ids', {});

      const hmac = createHmac('sha1', StorageTopic.Paddle);
      hmac.update(Object.keys(featureValue).sort().toString());
      const pricesHash = hmac.digest().toString('hex');

      const redisKey = generateStorageKey(
        StorageTopic.Paddle,
        StorageKey.PricingPreviewPlus,
        [pricesHash, region].join(':'),
      );

      let pricePreview: PricingPreview;

      const redisResult = await getRedisObject(redisKey);

      if (redisResult) {
        pricePreview = JSON.parse(redisResult);
      } else {
        pricePreview = await paddleInstance?.pricingPreview.preview({
          items: Object.keys(featureValue).map((priceId) => ({
            priceId,
            quantity: 1,
          })),
          address: region ? { countryCode: region as CountryCode } : undefined,
        });

        await setRedisObjectWithExpiry(
          redisKey,
          JSON.stringify(pricePreview),
          1 * ONE_HOUR_IN_SECONDS,
        );
      }

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
    pricingMetadata: async (
      _,
      { type = PurchaseType.Plus }: PaddlePricingPreviewArgs,
      ctx: AuthContext,
    ): Promise<BasePricingMetadata[]> => getPricingMetadata(ctx, type),
    pricingPreview: async (
      _,
      {
        type = PurchaseType.Plus,
        locale,
        discountId,
      }: PaddlePricingPreviewArgs,
      ctx,
    ): Promise<BasePricingPreview[]> => {
      const metadata = await getPricingMetadata(ctx, type);
      const ids = metadata
        .map(({ idMap }) => idMap.paddle)
        .filter(Boolean) as string[];

      const preview = await getPlusPricePreview(ctx, ids, discountId);

      // consolidate the preview data and metadata
      const consolidated = metadata.map((meta) => {
        const item = preview.details.lineItems.find(
          (item) => item.price.id === meta.idMap.paddle,
        );

        if (!item) {
          return null;
        }

        const duration =
          type === PurchaseType.Cores ? 'one-time' : getPricingDuration(item);
        const trialPeriod = item.price.trialPeriod;

        return {
          metadata: meta,
          priceId: item.price.id,
          price: getProductPrice(
            {
              total: item.formattedTotals.total,
              interval: item.price.billingCycle?.interval,
            },
            locale,
          ),
          currency: {
            code: preview.currencyCode,
            symbol: removeNumbers(item.formattedTotals.total),
          },
          duration,
          trialPeriod,
        } as BasePricingPreview;
      });

      return consolidated.filter(Boolean) as BasePricingPreview[];
    },
    pricingPreviewByIds: async (
      _,
      { ids, locale, loadMetadata }: PaddlePricingPreviewByIdsArgs,
      ctx,
    ): Promise<BasePricingWithoutMetadata[]> => {
      if (!ids.length) {
        throw new ValidationError('No ids provided');
      }

      const priceMetadata: Record<string, BasePricingMetadata> = loadMetadata
        ? await getPricingMetadataByPriceIds(ctx, ids)
        : {};

      const preview = await getPlusPricePreview(ctx, ids);
      const pricing = preview.details.lineItems.map((item) => ({
        priceId: item.price.id,
        price: getProductPrice(
          {
            total: item.formattedTotals.total,
            interval: item.price.billingCycle?.interval,
          },
          locale,
        ),
        duration: getPricingDuration(item),
        trialPeriod: item.price.trialPeriod,
        currency: {
          code: preview.currencyCode,
          symbol: removeNumbers(item.formattedTotals.total),
        },
        metadata: priceMetadata?.[item.price.id] ?? null,
      }));

      if (!pricing.length) {
        const err = new ValidationError('pricing returned no items');
        logger.error({ err, ids }, err.message);
        throw err;
      }

      return pricing;
    },
    corePricePreviews: async (_, __, ctx: AuthContext) => {
      const region = ctx.region;

      const corePaddleProductId = remoteConfig.vars.paddleProductIds?.cores;
      if (!corePaddleProductId) {
        throw new Error('Core product id is not set in remote config');
      }

      const redisKey = generateStorageKey(
        StorageTopic.Paddle,
        StorageKey.PricingPreviewCores,
        [corePaddleProductId, region].join(':'),
      );

      const redisResult = await getRedisObject(redisKey);

      if (redisResult) {
        const cachedResult = JSON.parse(redisResult);

        return cachedResult;
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

      await setRedisObjectWithExpiry(
        redisKey,
        JSON.stringify(result),
        1 * ONE_HOUR_IN_SECONDS,
      );

      return result;
    },
  },
});
