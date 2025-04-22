import { ConnectionManager, User } from '../../entity';
import { EntityNotFoundError } from 'typeorm';
import { CountryCode, TimePeriod } from '@paddle/paddle-node-sdk';
import { AuthContext } from '../../Context';
import { createHmac } from 'node:crypto';
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
import parseCurrency from 'parsecurrency';

export const PLUS_FEATURE_KEY = 'plus_pricing_ids';
export const DEFAULT_PLUS_METADATA = 'plus_default';
export const CORES_FEATURE_KEY = 'cores_pricing_ids';
export const DEFAULT_CORES_METADATA = 'cores_default';

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
  cores?: number;
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

export const getCoresPricingMetadata = async ({
  con,
  variant,
}: Omit<GetMetadataProps, 'feature'>): Promise<BasePricingMetadata[]> =>
  getPaddleMetadata({ con, feature: CORES_FEATURE_KEY, variant });

export enum PricingType {
  Plus = 'plus',
  Cores = 'cores',
}

const featureKey: Record<PricingType, string> = {
  [PricingType.Plus]: PLUS_FEATURE_KEY,
  [PricingType.Cores]: CORES_FEATURE_KEY,
};

const defaultVariant: Record<PricingType, string> = {
  [PricingType.Plus]: DEFAULT_PLUS_METADATA,
  [PricingType.Cores]: DEFAULT_CORES_METADATA,
};

export const getPricingDuration = (item: PricingPreviewLineItem) => {
  const isOneOff = !item.price.billingCycle?.interval;
  const isYearly = item.price.billingCycle?.interval === 'year';

  return isOneOff || isYearly
    ? SubscriptionCycles.Yearly
    : SubscriptionCycles.Monthly;
};

export const getCoresValue = () => {};

export const getPricingMetadata = async (
  ctx: AuthContext,
  type: PricingType,
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
    case PricingType.Plus:
      return getPlusPricingMetadata({ con, variant });
    case PricingType.Cores:
      return getCoresPricingMetadata({ con, variant });
    default:
      throw new Error('Invalid pricing type');
  }
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
      amount: parsed.value,
      formatted: formatted.replace(numericRegex, updatedFormat),
    };
  }

  const finalValue = formatter.format(parsed.value / divideBy);
  const dividedAmount = parsed.value / divideBy;
  const updatedFormat = formatted.replace(numericRegex, finalValue);

  return {
    amount: dividedAmount,
    formatted: updatedFormat,
  };
};

export const getProductPrice = (
  item: PricingPreviewLineItem,
  locale?: string,
) => {
  const basePrice: ProductPricing = getPrice({
    formatted: item.formattedTotals.total,
    locale,
  });

  const interval = item.price.billingCycle?.interval;

  if (!interval) {
    return basePrice;
  }

  if (interval === 'month') {
    basePrice.monthly = basePrice;
    basePrice.daily = getPrice({
      formatted: item.formattedTotals.total,
      divideBy: 30,
      locale,
    });

    return basePrice;
  }

  basePrice.monthly = getPrice({
    formatted: item.formattedTotals.total,
    divideBy: MONTHS_IN_YEAR,
    locale,
  });

  basePrice.daily = getPrice({
    formatted: item.formattedTotals.total,
    divideBy: DAYS_IN_YEAR,
    locale,
  });

  return basePrice;
};
