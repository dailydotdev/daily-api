import { remoteConfig } from './remoteConfig';

export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;

export const planTypes = remoteConfig.vars.pricingIds || {
  pri_01jcdp5ef4yhv00p43hr2knrdg: SubscriptionCycles.Monthly,
  pri_01jcdn6enr5ap3ekkddc6fv6tq: SubscriptionCycles.Yearly,
  pri_01gsz8x8sawmvhz1pv30nge1ke: SubscriptionCycles.Yearly,
};
