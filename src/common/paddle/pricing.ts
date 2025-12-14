import { createHmac } from 'node:crypto';
import { EntityNotFoundError } from 'typeorm';
import { z } from 'zod';
import parseCurrency from 'parsecurrency';
import {
  ConnectionManager,
  ExperimentVariant,
  ExperimentVariantType,
  User,
} from '../../entity';
import {
  CountryCode,
  TimePeriod,
  type Interval,
  type SubscriptionItem,
} from '@paddle/paddle-node-sdk';
import { AuthContext } from '../../Context';
import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import {
  PricingPreview,
  PricingPreviewLineItem,
} from '@paddle/paddle-node-sdk/dist/types/entities/pricing-preview';
import { getRedisObject, setRedisObjectWithExpiry } from '../../redis';
import { paddleInstance } from './index';
import { ONE_HOUR_IN_SECONDS } from '../constants';
import { getExperimentVariant } from '../experiment';
import {
  ExperimentAllocationClient,
  getUserGrowthBookInstance,
} from '../../growthbook';
import { SubscriptionCycles } from '../../paddle';
import { PurchaseType } from '../plus';

export const PLUS_FEATURE_KEY = 'plus_pricing_ids';
export const DEFAULT_PLUS_METADATA = 'plus_default';
export const CORES_FEATURE_KEY = 'cores_pricing_ids';
export const DEFAULT_CORES_METADATA = 'cores_default';
export const ORGANIZATION_FEATURE_KEY = 'organization_pricing_ids';
export const DEFAULT_ORGANIZATION_METADATA = 'organization_default';
export const RECRUITER_FEATURE_KEY = 'recruiter_pricing_ids';
export const DEFAULT_RECRUITER_METADATA = 'recruiter_default';

export interface BasePricingMetadata {
  appsId: string;
  title: string;
  caption?: {
    copy: string;
    color: string;
  };
  idMap: Partial<{
    paddle: string;
    ios: string;
  }>;
  coresValue?: number;
}

export interface PricePreview {
  amount: number;
  formatted: string;
}

interface ProductPricing extends PricePreview {
  monthly?: PricePreview;
  daily?: PricePreview;
}

export interface BasePricingPreview {
  metadata: BasePricingMetadata;
  priceId: string;
  price: ProductPricing;
  currency: {
    code: string;
    symbol: string;
  };
  duration: string;
  trialPeriod?: TimePeriod | null;
}

interface GetMetadataProps {
  con: ConnectionManager;
  feature: string;
  variant: string;
}

const getPaddleMetadata = async ({
  con,
  feature,
  variant,
}: GetMetadataProps) => {
  const experiment = await getExperimentVariant(con, feature, variant);

  if (!experiment) {
    throw new EntityNotFoundError('ExperimentVariant not found', {
      feature,
      variant,
    });
  }

  try {
    return JSON.parse(experiment.value);
  } catch (error) {
    throw new Error('Invalid experiment JSON value');
  }
};

export const getPlusPricingMetadata = async ({
  con,
  variant,
}: Omit<GetMetadataProps, 'feature'>): Promise<BasePricingMetadata[]> =>
  getPaddleMetadata({ con, feature: PLUS_FEATURE_KEY, variant });

export const getPlusOrganizationPricingMetadata = async ({
  con,
  variant,
}: Omit<GetMetadataProps, 'feature'>): Promise<BasePricingMetadata[]> =>
  getPaddleMetadata({ con, feature: ORGANIZATION_FEATURE_KEY, variant });

export const getCoresPricingMetadata = async ({
  con,
  variant,
}: Omit<GetMetadataProps, 'feature'>): Promise<BasePricingMetadata[]> =>
  getPaddleMetadata({ con, feature: CORES_FEATURE_KEY, variant });

export const getRecruiterPricingMetadata = async ({
  con,
  variant,
}: Omit<GetMetadataProps, 'feature'>): Promise<BasePricingMetadata[]> =>
  getPaddleMetadata({ con, feature: RECRUITER_FEATURE_KEY, variant });

const featureKey: Record<PurchaseType, string> = {
  [PurchaseType.Plus]: PLUS_FEATURE_KEY,
  [PurchaseType.Organization]: ORGANIZATION_FEATURE_KEY,
  [PurchaseType.Cores]: CORES_FEATURE_KEY,
  [PurchaseType.Recruiter]: RECRUITER_FEATURE_KEY,
};

const defaultVariant: Record<PurchaseType, string> = {
  [PurchaseType.Plus]: DEFAULT_PLUS_METADATA,
  [PurchaseType.Organization]: DEFAULT_ORGANIZATION_METADATA,
  [PurchaseType.Cores]: DEFAULT_CORES_METADATA,
  [PurchaseType.Recruiter]: DEFAULT_RECRUITER_METADATA,
};

export const getPricingDuration = (
  item: PricingPreviewLineItem | SubscriptionItem,
) => {
  const isOneOff = !item.price.billingCycle?.interval;
  const isYearly = item.price.billingCycle?.interval === 'year';

  return isOneOff || isYearly
    ? SubscriptionCycles.Yearly
    : SubscriptionCycles.Monthly;
};

export const getCoresValue = () => {};

export const getPricingMetadata = async (
  ctx: AuthContext,
  type: PurchaseType,
) => {
  const { con, userId } = ctx;
  const user = await con.getRepository(User).findOneOrFail({
    where: { id: ctx.userId },
    select: { createdAt: true },
  });
  const allocationClient = new ExperimentAllocationClient();
  const gb = getUserGrowthBookInstance(userId, {
    subscribeToChanges: false,
    attributes: { registrationDate: user.createdAt.toISOString() },
    allocationClient,
  });
  const variant = gb.getFeatureValue(featureKey[type], defaultVariant[type]);

  switch (type) {
    case PurchaseType.Plus:
      return getPlusPricingMetadata({ con, variant });
    case PurchaseType.Organization:
      return getPlusOrganizationPricingMetadata({ con, variant });
    case PurchaseType.Cores:
      return getCoresPricingMetadata({ con, variant });
    case PurchaseType.Recruiter:
      return getRecruiterPricingMetadata({ con, variant });
    default:
      throw new Error('Invalid pricing type');
  }
};

export const getPricingMetadataByPriceIds = async (
  ctx: AuthContext,
  pricingIds: string[],
): Promise<Record<string, BasePricingMetadata>> => {
  // Because we disable escaping, we need to ensure that the ids are valid
  // strings, just to be safe.
  const parsedPricingIds = z.array(z.string()).safeParse(pricingIds);
  if (parsedPricingIds.error) {
    return {};
  }

  const items = await ctx.con
    .createQueryBuilder()
    .select('item')
    .from(ExperimentVariant, 'ev')
    .addFrom('jsonb_array_elements(ev.value::jsonb)', 'item')
    .disableEscaping()
    .where("item -> 'idMap' ->> 'paddle' IN (:...ids)", {
      ids: parsedPricingIds.data,
    })
    .andWhere('ev.type = :type', {
      type: ExperimentVariantType.ProductPricing,
    })
    .getRawMany<{ item: BasePricingMetadata }>();

  return Object.fromEntries(items.map(({ item }) => [item.idMap.paddle, item]));
};

export const getPlusPricePreview = async (ctx: AuthContext, ids: string[]) => {
  const region = ctx.region;
  const sortedIds = ids.sort();

  const hmac = createHmac('sha1', StorageTopic.Paddle);
  hmac.update(sortedIds.toString());
  const pricesHash = hmac.digest().toString('hex');

  const redisKey = generateStorageKey(
    StorageTopic.Paddle,
    StorageKey.PricingPreviewPlus,
    [pricesHash, region].join(':'),
  );

  const redisResult = await getRedisObject(redisKey);

  if (redisResult) {
    return JSON.parse(redisResult) as PricingPreview;
  }

  const pricePreview = await paddleInstance?.pricingPreview.preview({
    items: sortedIds.map((priceId) => ({
      priceId,
      quantity: 1,
    })),
    address: region ? { countryCode: region as CountryCode } : undefined,
  });

  await setRedisObjectWithExpiry(
    redisKey,
    JSON.stringify(pricePreview),
    ONE_HOUR_IN_SECONDS,
  );

  return pricePreview;
};

const MONTHS_IN_YEAR = 12;
const DAYS_IN_YEAR = 365;
export const removeNumbers = (str: string) => str.replace(/\d|\.|\s|,/g, '');

interface GetPriceProps {
  formatted: string;
  locale?: string;
  divideBy?: number;
}

const numericRegex = /[\d.,]+/;

export const getPrice = ({
  formatted,
  locale = 'en-US',
  divideBy,
}: GetPriceProps) => {
  const parsed = parseCurrency(formatted);

  if (!parsed) {
    throw new Error('Invalid currency format');
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: parsed.decimals ? parsed.decimals.length - 1 : 0,
    maximumFractionDigits: parsed.decimals ? parsed.decimals.length - 1 : 0,
  });

  if (!divideBy) {
    const updatedFormat = formatter.format(parsed.value);

    return {
      amount: Number(parsed.value.toFixed(2)),
      formatted: formatted.replace(numericRegex, updatedFormat),
    };
  }

  const dividedAmount = parsed.value / divideBy;
  // Round to 3 decimal places first to handle floating point precision
  const roundedAmount = Math.round(dividedAmount * 1000) / 1000;
  // Then round down to 2 decimal places to preserve the original price's precision
  const finalAmount = Math.floor(roundedAmount * 100) / 100;
  const finalValue = formatter.format(finalAmount);
  const updatedFormat = formatted.replace(numericRegex, finalValue);

  return {
    amount: finalAmount,
    formatted: updatedFormat,
  };
};

export const getProductPrice = (
  {
    total,
    interval,
  }: {
    total: string;
    interval?: Interval;
  },
  locale?: string,
) => {
  const basePrice: ProductPricing = getPrice({
    formatted: total,
    locale,
  });

  if (!interval) {
    return basePrice;
  }

  if (interval === 'month') {
    basePrice.monthly = {
      amount: basePrice.amount,
      formatted: basePrice.formatted,
    };
    basePrice.daily = getPrice({
      formatted: total,
      divideBy: 30,
      locale,
    });

    return basePrice;
  }

  basePrice.monthly = getPrice({
    formatted: total,
    divideBy: MONTHS_IN_YEAR,
    locale,
  });

  basePrice.daily = getPrice({
    formatted: total,
    divideBy: DAYS_IN_YEAR,
    locale,
  });

  return basePrice;
};
