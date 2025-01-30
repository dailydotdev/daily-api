import { UserSubscriptionFlags } from './entity';

export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

// one year
export const subscriptionGiftDuration = 31557600000;

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;

export const isGiftedPlus = (
  subscriptionFlags?: UserSubscriptionFlags,
): subscriptionFlags is UserSubscriptionFlags &
  Required<Pick<UserSubscriptionFlags, 'gifterId' | 'cycle'>> =>
  (!!subscriptionFlags?.gifterId || false) &&
  isPlusMember(subscriptionFlags.cycle);
