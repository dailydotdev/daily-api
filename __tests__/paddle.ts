import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestingState,
  type GraphQLTestClient,
} from './helpers';
import { ExperimentVariant, ExperimentVariantType, User } from '../src/entity';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../src/common/plus';
import { plusUsersFixture, usersFixture } from './fixture';
import {
  EventName,
  SubscriptionCreatedEvent,
  TransactionCompletedEvent,
  type Customer,
  type SubscriptionStatus as PaddleSubscriptionStatus,
  CountryCode,
  CurrencyCode,
  PricingPreview,
} from '@paddle/paddle-node-sdk';
import { isPlusMember, SubscriptionCycles } from '../src/paddle';
import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { logger } from '../src/logger';
import { paddleInstance, type PaddleCustomData } from '../src/common/paddle';
import * as redisFile from '../src/redis';
import { ioRedisPool } from '../src/redis';
import {
  PLUS_FEATURE_KEY,
  DEFAULT_PLUS_METADATA,
  CORES_FEATURE_KEY,
  DEFAULT_CORES_METADATA,
} from '../src/common/paddle/pricing';
import { ClaimableItem, ClaimableItemTypes } from '../src/entity/ClaimableItem';
import type { PricingPreviewLineItem } from '@paddle/paddle-node-sdk/dist/types/entities/pricing-preview';
import {
  processGiftedPayment,
  updateUserSubscription,
} from '../src/common/paddle/plus/processing';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = '';

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser || undefined),
  );
  client = state.client;
  return app.ready();
});

beforeEach(async () => {
  jest.clearAllMocks();

  await saveFixtures(
    con,
    User,
    [...usersFixture, ...plusUsersFixture].map((user) => ({
      ...user,
      id: `whp-${user.id}`,
      flags: {
        vordr: false,
        trustScore: 1,
      },
    })),
  );
});

const getPricingPreviewData = () => ({
  details: {
    lineItems: [
      {
        price: {
          id: 'pri_monthly',
          name: 'Monthly Subscription',
          customData: {
            label: 'Monthly',
            appsId: 'monthly-sub',
          },
          billingCycle: {
            interval: 'month',
            frequency: 1,
          },
        },
        formattedTotals: {
          total: '$5.00',
        },
        totals: {
          total: '5.00',
        },
      },
      {
        price: {
          id: 'pri_yearly',
          name: 'Yearly Subscription',
          customData: {
            label: 'Yearly',
            appsId: 'yearly-sub',
          },
          billingCycle: {
            interval: 'year',
            frequency: 1,
          },
        },
        formattedTotals: {
          total: '$60.00',
        },
        totals: {
          total: '60.00',
        },
      },
    ],
  },
  currencyCode: 'USD',
});

const getSubscriptionData = (
  customData: PaddleCustomData,
  status: PaddleSubscriptionStatus = 'active',
) =>
  new SubscriptionCreatedEvent({
    event_id: '1',
    notification_id: '1',
    event_type: EventName.SubscriptionCreated,
    occurred_at: new Date().toISOString(),
    data: {
      id: '1',
      status,
      transaction_id: '1',
      customer_id: '1',
      address_id: '1',
      business_id: null,
      custom_data: customData,
      currency_code: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_mode: 'automatic',
      billing_cycle: {
        interval: 'month',
        frequency: 1,
      },
      items: [
        {
          price: {
            id: 'pricingGift',
            product_id: '1',
            name: 'Gift Subscription',
            description: 'Gift subscription for Daily.dev Plus',
            tax_mode: 'internal',
            billing_cycle: {
              interval: 'year',
              frequency: 1,
            },
          },
          status: 'active',
          quantity: 1,
          recurring: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    },
  });

const getTransactionData = (customData: PaddleCustomData) =>
  new TransactionCompletedEvent({
    event_id: '1',
    notification_id: '1',
    event_type: EventName.SubscriptionCreated,
    occurred_at: new Date().toISOString(),
    data: {
      id: '1',
      customer_id: '1',
      address_id: '1',
      business_id: null,
      custom_data: customData,
      currency_code: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_mode: 'automatic',
      status: 'completed',
      origin: 'web',
      payments: [],
      items: [],
    },
  });

describe('pricing preview', () => {
  const QUERY = `
    query PricePreviews {
      pricePreviews {
        currencyCode
        items {
          label
          value
          price {
            amount
            formatted
            monthlyAmount
            monthlyFormatted
          }
          currencyCode
          currencySymbol
          extraLabel
          appsId
          duration
          trialPeriod {
            interval
            frequency
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should return pricing preview data', async () => {
    loggedUser = 'whp-1';
    const mockPreview = jest.fn().mockResolvedValue(getPricingPreviewData());
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementation(mockPreview);

    const result = await client.query(QUERY);
    expect(result.data.pricePreviews.currencyCode).toBe('USD');
    expect(result.data.pricePreviews.items).toHaveLength(2);
    expect(result.data.pricePreviews.items[0].price.formatted).toBe('$5.00');
    expect(result.data.pricePreviews.items[0].price.monthlyFormatted).toBe(
      '$5.00',
    );
    expect(result.data.pricePreviews.items[1].price.formatted).toBe('$60.00');
    expect(result.data.pricePreviews.items[1].price.monthlyFormatted).toBe(
      '$5.00',
    );
  });

  it('should cache pricing preview data', async () => {
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');

    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );

    loggedUser = 'whp-1';
    const mockPreview = jest.fn().mockResolvedValue(getPricingPreviewData());
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementationOnce(mockPreview);

    const result = await client.query(QUERY);

    expect(result.errors).toBeFalsy();

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(getRedisObjectSpy).toHaveBeenCalledWith(
      'paddle:pricing_preview_plus:5a1afc9a87661f19ef8486f7d83ff8883eb0db40:',
    );

    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledWith(
      'paddle:pricing_preview_plus:5a1afc9a87661f19ef8486f7d83ff8883eb0db40:',
      expect.any(String),
      3600,
    );

    const result2 = await client.query(QUERY);

    expect(result2.errors).toBeFalsy();

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);

    expect(result).toEqual(result2);
  });
});

describe('plus pricing metadata', () => {
  const QUERY = /* GraphQL */ `
    query PricingMetadata($type: PricingType) {
      pricingMetadata(type: $type) {
        appsId
        title
        caption {
          copy
          color
        }
        idMap {
          paddle
          ios
        }
        coresValue
      }
    }
  `;

  const mockPlusMetadata = [
    {
      appsId: 'monthly',
      title: 'Monthly Plan',
      caption: {
        copy: 'Best for individuals',
        color: 'bun',
      },
      idMap: {
        paddle: 'pri_monthly',
        ios: 'com.daily.dev.plus.monthly',
      },
    },
    {
      appsId: 'yearly',
      title: 'Yearly Plan',
      caption: {
        copy: 'Best value',
        color: 'success',
      },
      idMap: {
        paddle: 'pri_yearly',
        ios: 'com.daily.dev.plus.yearly',
      },
    },
  ];

  const mockCoresMetadata = [
    {
      appsId: 'custom',
      title: 'Custom Plan',
      idMap: {
        paddle: 'pri_custom',
        ios: 'com.daily.dev.plus.custom',
      },
      coresValue: 100,
    },
  ];

  beforeEach(async () => {
    await saveFixtures(con, ExperimentVariant, [
      {
        feature: PLUS_FEATURE_KEY,
        variant: DEFAULT_PLUS_METADATA,
        value: JSON.stringify(mockPlusMetadata),
        type: ExperimentVariantType.ProductPricing,
      },
      {
        feature: CORES_FEATURE_KEY,
        variant: DEFAULT_CORES_METADATA,
        value: JSON.stringify(mockCoresMetadata),
        type: ExperimentVariantType.ProductPricing,
      },
    ]);
  });

  it('should return pricing metadata with default type', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY);
    expect(result.data.pricingMetadata).toHaveLength(2);
    expect(result.data.pricingMetadata[0].appsId).toBe('monthly');
    expect(result.data.pricingMetadata[1].appsId).toBe('yearly');
  });

  it('should return pricing metadata for pricing type', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { type: PurchaseType.Cores },
    });
    expect(result.data.pricingMetadata).toHaveLength(1);
    expect(result.data.pricingMetadata[0].appsId).toBe('custom');
    expect(result.data.pricingMetadata[0].coresValue).toBe(100);
  });
});

describe('plus pricing preview', () => {
  const QUERY = /* GraphQL */ `
    query PricingPreview($type: PricingType, $locale: String) {
      pricingPreview(type: $type, locale: $locale) {
        metadata {
          appsId
          title
          caption {
            copy
            color
          }
          idMap {
            paddle
            ios
          }
        }
        priceId
        price {
          amount
          formatted
          monthly {
            amount
            formatted
          }
          daily {
            amount
            formatted
          }
        }
        currency {
          code
          symbol
        }
        duration
        trialPeriod {
          interval
          frequency
        }
      }
    }
  `;

  const mockMetadata = [
    {
      appsId: 'monthly',
      title: 'Monthly Plan',
      caption: {
        copy: 'Best for individuals',
        color: '#000000',
      },
      idMap: {
        paddle: 'pri_monthly',
        ios: 'com.daily.dev.plus.monthly',
      },
    },
  ];

  const mockPreview = {
    customerId: '1',
    addressId: '1',
    businessId: null,
    discountId: null,
    address: {
      countryCode: 'US',
      postalCode: '12345',
    },
    customerIpAddress: '127.0.0.1',
    availablePaymentMethods: ['card'],
    details: {
      lineItems: [
        {
          price: {
            id: 'pri_monthly',
            productId: 'dailydev-plus',
            name: 'Monthly Subscription',
            billingCycle: {
              interval: 'month',
              frequency: 1,
            },
            trialPeriod: {
              interval: 'day',
              frequency: 14,
            },
          },
          formattedTotals: {
            total: '$5.00',
          },
          totals: {
            total: '5.00',
          },
        },
      ],
    },
    currencyCode: 'USD',
  } as const;

  const mockPreviewWithMissingItem = {
    customerId: '1',
    addressId: '1',
    businessId: null,
    discountId: null,
    address: {
      countryCode: 'US',
      postalCode: '12345',
    },
    customerIpAddress: '127.0.0.1',
    availablePaymentMethods: ['card'],
    details: {
      lineItems: [
        {
          price: {
            id: 'pri_unknown',
            productId: 'dailydev-plus',
            name: 'Unknown Plan',
          },
        },
      ],
    },
    currencyCode: 'USD',
  } as const;

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    await saveFixtures(con, ExperimentVariant, [
      {
        feature: PLUS_FEATURE_KEY,
        variant: DEFAULT_PLUS_METADATA,
        value: JSON.stringify(mockMetadata),
        type: ExperimentVariantType.ProductPricing,
      },
    ]);

    const mockPreviewFn = jest.fn().mockResolvedValue(mockPreview);
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementation(mockPreviewFn);
  });

  it('should return consolidated pricing preview data', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { type: PurchaseType.Plus },
    });
    expect(result.data.pricingPreview).toHaveLength(1);
    const preview = result.data.pricingPreview[0];
    expect(preview.metadata.appsId).toBe('monthly');
    expect(preview.metadata.title).toBe('Monthly Plan');
    expect(preview.priceId).toBe('pri_monthly');
    expect(preview.price.amount).toBe(5);
    expect(preview.price.formatted).toBe('$5.00');
    expect(preview.currency.code).toBe('USD');
    expect(preview.currency.symbol).toBe('$');
    expect(preview.duration).toBe('monthly');
    expect(preview.trialPeriod.interval).toBe('day');
    expect(preview.trialPeriod.frequency).toBe(14);
  });

  it('should handle missing price items gracefully', async () => {
    loggedUser = 'whp-1';
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockResolvedValue(mockPreviewWithMissingItem);

    const result = await client.query(QUERY, {
      variables: { type: PurchaseType.Plus },
    });
    expect(result.data.pricingPreview).toHaveLength(0);
  });

  it('should cache pricing preview data', async () => {
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );

    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { type: PurchaseType.Plus },
    });

    expect(result.errors).toBeFalsy();
    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);

    const result2 = await client.query(QUERY, {
      variables: { type: PurchaseType.Plus },
    });
    expect(result2.errors).toBeFalsy();
    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);

    expect(result).toEqual(result2);
  });

  it('should format prices according to locale', async () => {
    loggedUser = 'whp-1';
    const mockPreview = {
      customerId: '1',
      addressId: '1',
      businessId: null,
      discountId: null,
      address: {
        countryCode: 'DE' as CountryCode,
        postalCode: '12345',
      },
      customerIpAddress: '127.0.0.1',
      availablePaymentMethods: ['card' as const],
      details: {
        lineItems: [
          {
            price: {
              id: 'pri_monthly',
              productId: 'prod_123',
              name: 'Monthly Subscription',
              description: 'Monthly subscription for Daily.dev Plus',
              type: 'standard' as const,
              status: 'active' as const,
              quantity: {
                minimum: 1,
                maximum: 1,
              },
              customData: {
                label: 'Monthly',
                appsId: 'monthly-sub',
              },
              billingCycle: {
                interval: 'month' as const,
                frequency: 1,
              },
              trialPeriod: null,
              unitPrice: {
                amount: '5.00',
                currencyCode: 'EUR' as CurrencyCode,
              },
              unitPriceOverrides: [],
              taxMode: 'internal' as const,
              productTaxCategory: 'standard',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              importMeta: null,
              product: {
                id: 'prod_123',
                name: 'Daily.dev Plus',
                description: 'Daily.dev Plus Subscription',
                type: 'standard' as const,
                taxCategory: 'standard' as const,
                imageUrl: 'https://daily.dev/plus.png',
                customData: {},
                status: 'active' as const,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                importMeta: null,
                prices: [],
              },
            },
            product: {
              id: 'prod_123',
              name: 'Daily.dev Plus',
              description: 'Daily.dev Plus Subscription',
              type: 'standard' as const,
              taxCategory: 'standard' as const,
              imageUrl: 'https://daily.dev/plus.png',
              customData: {},
              status: 'active' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              importMeta: null,
              prices: [],
            },
            quantity: 1,
            taxRate: '0.00',
            unitTotals: {
              subtotal: '5.00',
              discount: '0.00',
              tax: '0.00',
              total: '5.00',
            },
            formattedUnitTotals: {
              subtotal: '€5,00',
              discount: '€0,00',
              tax: '€0,00',
              total: '€5,00',
            },
            formattedTotals: {
              subtotal: '€5,00',
              discount: '€0,00',
              tax: '€0,00',
              total: '€5,00',
            },
            totals: {
              subtotal: '5.00',
              discount: '0.00',
              tax: '0.00',
              total: '5.00',
            },
            discounts: [],
          },
        ],
      },
      currencyCode: 'EUR' as CurrencyCode,
    };

    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockResolvedValue(mockPreview as never);

    const result = await client.query(QUERY, {
      variables: {
        type: PurchaseType.Plus,
        locale: 'de-DE',
      },
    });
    expect(result.data.pricingPreview).toHaveLength(1);
    const preview = result.data.pricingPreview[0];
    expect(preview.price.formatted).toBe('€5,00');
  });

  it('should use default locale when not specified', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: {
        type: PurchaseType.Plus,
      },
    });
    expect(result.data.pricingPreview).toHaveLength(1);
    const preview = result.data.pricingPreview[0];
    expect(preview.price.formatted).toBe('$5.00');
  });
});

describe('pricing preview by ids', () => {
  const QUERY = /* GraphQL */ `
    query PricingPreviewByIds(
      $ids: [String]!
      $locale: String
      $loadMetadata: Boolean
    ) {
      pricingPreviewByIds(
        ids: $ids
        locale: $locale
        loadMetadata: $loadMetadata
      ) {
        priceId
        price {
          amount
          formatted
          monthly {
            amount
            formatted
          }
          daily {
            amount
            formatted
          }
        }
        currency {
          code
          symbol
        }
        duration
        trialPeriod {
          interval
          frequency
        }
        metadata {
          title
          caption {
            copy
          }
        }
      }
    }
  `;

  const mockPreview: PricingPreview = {
    customerId: '1',
    addressId: '1',
    businessId: null,
    discountId: null,
    address: {
      countryCode: 'US' as CountryCode,
      postalCode: '12345',
    },
    customerIpAddress: '127.0.0.1',
    availablePaymentMethods: ['card'],
    details: {
      lineItems: [
        {
          price: {
            id: 'pri_monthly',
            productId: 'dailydev-plus',
            name: 'Monthly Subscription',
            billingCycle: {
              interval: 'month',
              frequency: 1,
            },
            trialPeriod: {
              interval: 'day',
              frequency: 14,
            },
          },
          formattedTotals: {
            total: '$5.00',
          },
          totals: {
            total: '5.00',
          },
        },
        {
          price: {
            id: 'pri_yearly',
            productId: 'dailydev-plus',
            name: 'Yearly Subscription',
            billingCycle: {
              interval: 'year',
              frequency: 1,
            },
            trialPeriod: null,
          },
          formattedTotals: {
            total: '$60.00',
          },
          totals: {
            total: '60.00',
          },
        },
      ] as PricingPreviewLineItem[],
    },
    currencyCode: 'USD' as CurrencyCode,
  };

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    const mockPreviewFn = jest.fn().mockResolvedValue(mockPreview);
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementation(mockPreviewFn);
  });

  it('should return pricing preview data for given ids', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { ids: ['pri_monthly', 'pri_yearly'] },
    });

    expect(result.errors).toBeFalsy();
    expect(result.data?.pricingPreviewByIds).toHaveLength(2);

    const monthlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_monthly',
    );
    expect(monthlyPreview?.price.amount).toBe(5);
    expect(monthlyPreview?.price.formatted).toBe('$5.00');
    expect(monthlyPreview?.price.monthly.amount).toBe(5);
    expect(monthlyPreview?.price.monthly.formatted).toBe('$5.00');
    expect(monthlyPreview?.price.daily.amount).toBe(0.16);
    expect(monthlyPreview?.price.daily.formatted).toBe('$0.16');
    expect(monthlyPreview?.currency.code).toBe('USD');
    expect(monthlyPreview?.currency.symbol).toBe('$');
    expect(monthlyPreview?.duration).toBe('monthly');
    expect(monthlyPreview?.trialPeriod?.interval).toBe('day');
    expect(monthlyPreview?.trialPeriod?.frequency).toBe(14);
    expect(monthlyPreview?.metadata).toBeNull();

    const yearlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_yearly',
    );
    expect(yearlyPreview?.price.amount).toBe(60);
    expect(yearlyPreview?.price.formatted).toBe('$60.00');
    expect(yearlyPreview?.price.monthly.amount).toBe(5);
    expect(yearlyPreview?.price.monthly.formatted).toBe('$5.00');
    expect(yearlyPreview?.price.daily.amount).toBe(0.16);
    expect(yearlyPreview?.price.daily.formatted).toBe('$0.16');
    expect(yearlyPreview?.currency.code).toBe('USD');
    expect(yearlyPreview?.currency.symbol).toBe('$');
    expect(yearlyPreview?.duration).toBe('yearly');
    expect(yearlyPreview?.trialPeriod).toBeNull();
    expect(yearlyPreview?.metadata).toBeNull();
  });

  it('should throw error when no ids are provided', async () => {
    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { ids: [] },
    });

    expect(result.errors?.[0]?.message).toBe('No ids provided');
  });

  it('should throw error when no pricing data is found', async () => {
    loggedUser = 'whp-1';
    const emptyPreview: PricingPreview = {
      ...mockPreview,
      details: { lineItems: [] },
    };

    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockResolvedValue(emptyPreview);

    const result = await client.query(QUERY, {
      variables: { ids: ['pri_monthly'] },
    });

    expect(result.errors?.[0]?.message).toBe('pricing returned no items');
  });

  it('should format prices according to locale', async () => {
    loggedUser = 'whp-1';
    const mockPreviewWithEuro: PricingPreview = {
      ...mockPreview,
      details: {
        lineItems: [
          {
            ...mockPreview.details.lineItems[0],
            formattedTotals: { total: '€5,00' },
            totals: { total: '5.00' },
          },
        ] as PricingPreviewLineItem[],
      },
      currencyCode: 'EUR' as CurrencyCode,
    };

    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockResolvedValue(mockPreviewWithEuro);

    const result = await client.query(QUERY, {
      variables: { ids: ['pri_monthly'], locale: 'de-DE' },
    });

    expect(result.errors).toBeFalsy();
    expect(result.data?.pricingPreviewByIds).toHaveLength(1);
    const preview = result.data?.pricingPreviewByIds[0];
    expect(preview?.price.formatted).toBe('€5,00');
    expect(preview?.price.monthly.formatted).toBe('€5,00');
    expect(preview?.price.daily.formatted).toBe('€0,16');
    expect(preview?.currency.code).toBe('EUR');
    expect(preview?.currency.symbol).toBe('€');
  });

  it('should cache pricing preview data', async () => {
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );

    loggedUser = 'whp-1';
    const result = await client.query(QUERY, {
      variables: { ids: ['pri_monthly'] },
    });

    expect(result.errors).toBeFalsy();
    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);

    const result2 = await client.query(QUERY, {
      variables: { ids: ['pri_monthly'] },
    });

    expect(result2.errors).toBeFalsy();
    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(result2);
  });

  it('should return metadata when requested', async () => {
    loggedUser = 'whp-1';
    await con.getRepository(ExperimentVariant).save([
      {
        feature: 'featureKey1',
        variant: 'featureVariant1',
        type: ExperimentVariantType.ProductPricing,
        value: JSON.stringify([
          {
            idMap: {
              paddle: 'pri_monthly',
            },
            title: 'Plus Subscription',
            caption: {
              copy: 'Get access to exclusive features',
            },
          },
        ]),
      },
      {
        feature: 'featureKey2',
        variant: 'featureVariant2',
        type: ExperimentVariantType.ProductPricing,
        value: JSON.stringify([
          {
            idMap: {
              paddle: 'pri_yearly',
            },
            title: 'Variant Plus Subscription',
            caption: {
              copy: '50% off',
            },
          },
        ]),
      },
    ]);

    const result = await client.query(QUERY, {
      variables: {
        ids: ['pri_monthly', 'pri_yearly'],
        loadMetadata: true,
      },
    });

    expect(result.errors).toBeFalsy();
    expect(result.data?.pricingPreviewByIds).toHaveLength(2);

    const monthlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_monthly',
    );

    expect(monthlyPreview?.metadata).toMatchObject({
      title: 'Plus Subscription',
      caption: {
        copy: 'Get access to exclusive features',
      },
    });

    const yearlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_yearly',
    );

    expect(yearlyPreview?.metadata).toMatchObject({
      title: 'Variant Plus Subscription',
      caption: {
        copy: '50% off',
      },
    });
  });

  it('should return null metadata when price id is not found', async () => {
    loggedUser = 'whp-1';
    await con.getRepository(ExperimentVariant).save([
      {
        feature: 'featureKey1',
        variant: 'featureVariant1',
        type: ExperimentVariantType.ProductPricing,
        value: JSON.stringify([
          {
            idMap: {
              paddle: 'pri_monthly',
            },
            title: 'Plus Subscription',
            caption: {
              copy: 'Get access to exclusive features',
            },
          },
        ]),
      },
    ]);

    const result = await client.query(QUERY, {
      variables: {
        ids: ['pri_monthly', 'pri_yearly'],
        loadMetadata: true,
      },
    });

    expect(result.errors).toBeFalsy();
    expect(result.data?.pricingPreviewByIds).toHaveLength(2);

    const monthlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_monthly',
    );

    expect(monthlyPreview?.metadata).toMatchObject({
      title: 'Plus Subscription',
      caption: {
        copy: 'Get access to exclusive features',
      },
    });

    const yearlyPreview = result.data?.pricingPreviewByIds.find(
      (p) => p.priceId === 'pri_yearly',
    );

    expect(yearlyPreview?.metadata).toBeNull();
  });
});

describe('plus subscription', () => {
  it('should add a plus subscription to a user', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(false);

    const data = getSubscriptionData({
      user_id: userId,
    });
    await updateUserSubscription({ event: data });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(true);
    expect(updatedUser.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.Paddle,
    );
  });

  it('should activate subscription when status is trialing', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(false);

    const data = getSubscriptionData(
      {
        user_id: userId,
      },
      'trialing',
    );
    await updateUserSubscription({ event: data });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(true);
    expect(updatedUser.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.Paddle,
    );
    expect(updatedUser.subscriptionFlags?.status).toEqual(
      SubscriptionStatus.Active,
    );
  });

  it('should revoke subscription when status is canceled', async () => {
    const userId = 'whp-1';
    await con.getRepository(User).update(
      { id: userId },
      {
        subscriptionFlags: {
          cycle: SubscriptionCycles.Yearly,
          provider: SubscriptionProvider.Paddle,
          status: SubscriptionStatus.Active,
          subscriptionId: '1',
        },
      },
    );

    const data = getSubscriptionData(
      {
        user_id: userId,
      },
      'canceled',
    );
    await updateUserSubscription({ event: data });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should revoke subscription when status is paused', async () => {
    const userId = 'whp-1';
    await con.getRepository(User).update(
      { id: userId },
      {
        subscriptionFlags: {
          cycle: SubscriptionCycles.Yearly,
          provider: SubscriptionProvider.Paddle,
          status: SubscriptionStatus.Active,
          subscriptionId: '1',
        },
      },
    );

    const data = getSubscriptionData(
      {
        user_id: userId,
      },
      'paused',
    );
    await updateUserSubscription({ event: data });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should revoke subscription when status is past_due', async () => {
    const userId = 'whp-1';
    await con.getRepository(User).update(
      { id: userId },
      {
        subscriptionFlags: {
          cycle: SubscriptionCycles.Yearly,
          provider: SubscriptionProvider.Paddle,
          status: SubscriptionStatus.Active,
          subscriptionId: '1',
        },
      },
    );

    const data = getSubscriptionData(
      {
        user_id: userId,
      },
      'past_due',
    );
    await updateUserSubscription({ event: data });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should add an anonymous subscription to the claimable_items table', async () => {
    const mockCustomer = { email: 'test@example.com' };

    jest
      .spyOn(paddleInstance.customers, 'get')
      .mockResolvedValue(mockCustomer as Customer);

    const data = getSubscriptionData({
      user_id: undefined,
    });

    await updateUserSubscription({ event: data });

    const claimableItem = await con
      .getRepository(ClaimableItem)
      .findOneByOrFail({ email: mockCustomer.email });

    expect(claimableItem).toBeTruthy();
    expect(claimableItem.email).toBe('test@example.com');
    expect(claimableItem.type).toBe(ClaimableItemTypes.Plus);
    expect(claimableItem.flags).toHaveProperty(
      'cycle',
      SubscriptionCycles.Yearly,
    );
    expect(claimableItem.flags).toHaveProperty(
      'createdAt',
      data.data.startedAt,
    );
    expect(claimableItem.flags).toHaveProperty('subscriptionId', data.data.id);
    expect(claimableItem.flags).toHaveProperty(
      'provider',
      SubscriptionProvider.Paddle,
    );
    expect(claimableItem.flags).toHaveProperty(
      'status',
      SubscriptionStatus.Active,
    );
  });
});

it('should throw an error if the email already has a claimable subscription', async () => {
  const mockCustomer = { email: 'test@example.com' };

  jest
    .spyOn(paddleInstance.customers, 'get')
    .mockResolvedValue(mockCustomer as Customer);

  const data = getSubscriptionData({
    user_id: undefined,
  });

  await con.getRepository(ClaimableItem).save({
    email: 'test@example.com',
    type: ClaimableItemTypes.Plus,
    flags: {
      cycle: SubscriptionCycles.Yearly,
    },
  });

  await expect(updateUserSubscription({ event: data })).rejects.toThrow(
    `User already has a claimable subscription`,
  );
});

it('should not throw an error if the email has claimed a previously claimable subscription', async () => {
  const mockCustomer = { email: 'test@example.com' };

  jest
    .spyOn(paddleInstance.customers, 'get')
    .mockResolvedValue(mockCustomer as Customer);

  await con.getRepository(ClaimableItem).save({
    email: 'test@example.com',
    type: ClaimableItemTypes.Plus,
    flags: {
      cycle: SubscriptionCycles.Yearly,
    },
    claimedAt: new Date(),
  });

  const data = getSubscriptionData({
    user_id: undefined,
  });

  await expect(updateUserSubscription({ event: data })).resolves.not.toThrow();
});

describe('anonymous subscription', () => {
  it('should add an anonymous subscription to the claimable_items table', async () => {
    const mockCustomer = { email: 'test@example.com' };

    jest
      .spyOn(paddleInstance.customers, 'get')
      .mockResolvedValue(mockCustomer as Customer);

    const data = getSubscriptionData({
      user_id: undefined,
    });

    await updateUserSubscription({ event: data });

    const claimableItem = await con
      .getRepository(ClaimableItem)
      .findOneByOrFail({ email: mockCustomer.email });

    expect(claimableItem).toBeTruthy();
    expect(claimableItem.email).toBe('test@example.com');
    expect(claimableItem.type).toBe(ClaimableItemTypes.Plus);
    expect(claimableItem.flags).toHaveProperty(
      'cycle',
      SubscriptionCycles.Yearly,
    );
    expect(claimableItem.flags).toHaveProperty(
      'createdAt',
      data.data.startedAt,
    );
    expect(claimableItem.flags).toHaveProperty('subscriptionId', data.data.id);
    expect(claimableItem.flags).toHaveProperty(
      'provider',
      SubscriptionProvider.Paddle,
    );
    expect(claimableItem.flags).toHaveProperty(
      'status',
      SubscriptionStatus.Active,
    );
  });

  it('should throw an error if the email already has a claimable subscription', async () => {
    const mockCustomer = { email: 'test@example.com' };

    jest
      .spyOn(paddleInstance.customers, 'get')
      .mockResolvedValue(mockCustomer as Customer);

    const data = getSubscriptionData({
      user_id: undefined,
    });

    await con.getRepository(ClaimableItem).save({
      email: 'test@example.com',
      type: ClaimableItemTypes.Plus,
      flags: {
        status: SubscriptionStatus.Active,
        provider: SubscriptionProvider.Paddle,
        cycle: SubscriptionCycles.Yearly,
        subscriptionId: '1',
      },
    });

    await expect(updateUserSubscription({ event: data })).rejects.toThrow(
      `User already has a claimable subscription`,
    );
  });

  it('should not throw an error if the email has claimed a previously claimable subscription', async () => {
    const mockCustomer = { email: 'test@example.com' };

    jest
      .spyOn(paddleInstance.customers, 'get')
      .mockResolvedValue(mockCustomer as Customer);

    await con.getRepository(ClaimableItem).save({
      email: 'test@example.com',
      type: ClaimableItemTypes.Plus,
      flags: {
        status: SubscriptionStatus.Active,
        provider: SubscriptionProvider.Paddle,
        cycle: SubscriptionCycles.Yearly,
        subscriptionId: '1',
      },
      claimedAt: new Date(),
    });

    const data = getSubscriptionData({
      user_id: undefined,
    });

    await expect(
      updateUserSubscription({ event: data }),
    ).resolves.not.toThrow();
  });

  it('should drop a claimable item if the subscription is canceled', async () => {
    const mockCustomer = { email: 'test@example.com' };

    await con.getRepository(ClaimableItem).save({
      email: 'test@example.com',
      type: ClaimableItemTypes.Plus,
      flags: {
        status: SubscriptionStatus.Active,
        provider: SubscriptionProvider.Paddle,
        cycle: SubscriptionCycles.Yearly,
        subscriptionId: '1',
      },
    });

    jest
      .spyOn(paddleInstance.customers, 'get')
      .mockResolvedValue(mockCustomer as Customer);

    const data = getSubscriptionData(
      {
        user_id: undefined,
      },
      'canceled',
    );

    await updateUserSubscription({ event: data });

    const claimableItem = await con
      .getRepository(ClaimableItem)
      .findOneBy({ email: mockCustomer.email });

    expect(claimableItem).toBeNull();
  });
});

describe('gift', () => {
  const logError = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should ignore if gifter user is not valid', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-2';
    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-10',
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should ignore if gifter and user is the same', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-2';
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(false);

    const result = getTransactionData({
      user_id: userId,
      gifter_id: userId,
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should ignore if user is already plus', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-1';
    await con
      .getRepository(User)
      .update(
        { id: userId },
        { subscriptionFlags: { cycle: SubscriptionCycles.Monthly } },
      );
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(true);

    const result = getTransactionData({
      user_id: user.id,
      gifter_id: 'whp-2',
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();
  });

  it('should gift a subscription to a user', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: 'whp-1' });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);

    expect(isInitiallyPlus).toBe(false);

    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-2',
    });

    await processGiftedPayment({ event: result });
    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(true);
    expect(updatedUser.subscriptionFlags?.gifterId).toBe('whp-2');
    expect(updatedUser.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.Paddle,
    );
    const expireDate =
      updatedUser.subscriptionFlags?.giftExpirationDate &&
      new Date(updatedUser.subscriptionFlags?.giftExpirationDate);
    expect(expireDate).toBeInstanceOf(Date);
    expect(expireDate?.getFullYear()).toBe(new Date().getFullYear() + 1);
  });

  it('should add showPlusGift flags to recipient when gifted', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: 'whp-1' });

    expect(isPlusMember(user.subscriptionFlags?.cycle)).toBe(false);
    expect(user.flags).toStrictEqual({
      vordr: false,
      trustScore: 1,
    });

    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-2',
    });

    await processGiftedPayment({ event: result });
    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });

    expect(isPlusMember(updatedUser.subscriptionFlags?.cycle)).toBe(true);
    expect(updatedUser.flags).toStrictEqual({
      vordr: false,
      trustScore: 1,
      showPlusGift: true,
    });
  });
});
