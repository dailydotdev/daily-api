import { ConnectionManager } from '../../entity';
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

export const PLUS_FEATURE_KEY = 'plus_pricing_ids';
export const DEFAULT_PLUS_METADATA = 'plus_default';

export interface PlusPricingMetadata {
  appsId: string;
  title: string;
  caption?: {
    copy: string;
    color: string;
  };
  idMap: {
    paddle: string;
    ios: string;
  };
}

export interface PricePreview {
  amount: number;
  formatted: string;
}

export interface PlusPricingPreview {
  metadata: PlusPricingMetadata;
  priceId: string;
  price: PricePreview & { monthly: PricePreview };
  currency: {
    code: string;
    symbol: string;
  };
  duration: string;
  trialPeriod?: TimePeriod | null;
}

// instead of storing a seed in the DB, having this here makes it easier to modify
const devPricingMetadata: PlusPricingMetadata[] = [
  {
    appsId: 'early_adopter',
    title: 'Annual Special',
    caption: {
      copy: '💜 Early bird',
      color: 'help',
    },
    idMap: {
      paddle: 'pri_01jkzypjstw7k6w82375mafc89',
      ios: 'early_adopter',
    },
  },
  {
    appsId: 'annual',
    title: 'Annual',
    caption: {
      copy: 'Save 2 months',
      color: 'success',
    },
    idMap: {
      paddle: 'pri_01jcdn6enr5ap3ekkddc6fv6tq',
      ios: 'annual',
    },
  },
  {
    appsId: 'monthly',
    title: 'Monthly',
    idMap: {
      paddle: 'pri_01jcdp5ef4yhv00p43hr2knrdg',
      ios: 'monthly',
    },
  },
  {
    appsId: 'gift_one_year',
    title: 'One year plan',
    caption: {
      copy: 'Save 50%',
      color: 'success',
    },
    idMap: {
      paddle: 'pri_01jjbwd5j7k0nm45k8e07yfmwr',
      ios: 'gift_one_year',
    },
  },
];

export const getPlusPricingMetadata = async (
  con: ConnectionManager,
  variant: string,
): Promise<PlusPricingMetadata[]> => {
  if (process.env.NODE_ENV === 'development') {
    return devPricingMetadata;
  }

  const experiment = await getExperimentVariant(con, PLUS_FEATURE_KEY, variant);

  if (!experiment) {
    throw new EntityNotFoundError('ExperimentVariant not found', {
      feature: PLUS_FEATURE_KEY,
      variant,
    });
  }

  try {
    return JSON.parse(experiment.value);
  } catch (error) {
    throw new Error('Invalid experiment JSON value');
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

  if (process.env.NODE_ENV === 'development') {
    return pricePreview;
  }

  await setRedisObjectWithExpiry(
    redisKey,
    JSON.stringify(pricePreview),
    ONE_HOUR_IN_SECONDS,
  );

  return pricePreview;
};

const MONTHS_IN_YEAR = 12;
export const removeNumbers = (str: string) => str.replace(/\d|\.|\s|,/g, '');

export const getPaddleMonthlyPrice = (
  baseAmount: number,
  item: PricingPreviewLineItem,
): PricePreview => {
  const monthlyPrice = Number(
    (baseAmount / MONTHS_IN_YEAR).toString().match(/^-?\d+(?:\.\d{0,2})?/)?.[0],
  );
  const currencySymbol = removeNumbers(item.formattedTotals.total);
  const priceFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
  });

  return {
    amount: monthlyPrice,
    formatted: `${currencySymbol}${priceFormatter.format(monthlyPrice)}`,
  };
};
