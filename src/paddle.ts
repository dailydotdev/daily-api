import { remoteConfig } from './remoteConfig';

export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;

export const planTypes = remoteConfig.vars.pricingIds || {};
