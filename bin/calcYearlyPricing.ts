import {
  type Environment,
  type Money,
  Paddle,
  UpdatePriceRequestBody,
} from '@paddle/paddle-node-sdk';
import { remoteConfig } from '../src/remoteConfig';
import { SubscriptionCycles } from '../src/paddle';

function calcYearlyPrice(unitPrice: Money): Money {
  const amount = (parseFloat(unitPrice.amount) * 10).toString();
  return {
    amount,
    currencyCode: unitPrice.currencyCode,
  };
}

async function run(): Promise<void> {
  const paddle = new Paddle(process.env.PADDLE_API_KEY, {
    environment: process.env.PADDLE_ENVIRONMENT as Environment,
  });
  await remoteConfig.init();
  const pricingIds = remoteConfig.vars.pricingIds;
  if (!pricingIds) {
    throw new Error('missing pricing ids');
  }

  const monthlyPriceId = Object.keys(pricingIds).find(
    (x) => pricingIds[x] === SubscriptionCycles.Monthly,
  ) as string;
  const yearlyPriceId = Object.keys(pricingIds).find(
    (x) => pricingIds[x] === SubscriptionCycles.Yearly,
  ) as string;

  const monthlyPrice = await paddle.prices.get(monthlyPriceId);

  const updatedYearlyPrice: UpdatePriceRequestBody = {
    unitPrice: calcYearlyPrice(monthlyPrice.unitPrice),
    unitPriceOverrides: monthlyPrice.unitPriceOverrides?.map((x) => ({
      countryCodes: x.countryCodes,
      unitPrice: calcYearlyPrice(x.unitPrice),
    })),
  };

  await paddle.prices.update(yearlyPriceId, updatedYearlyPrice);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
