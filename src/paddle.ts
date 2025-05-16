import type {
  SubscriptionCreatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionUpdatedEvent,
} from '@paddle/paddle-node-sdk';
import { UserSubscriptionFlags } from './entity';

export type PaddleSubscriptionEvent =
  | SubscriptionCreatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionUpdatedEvent;

export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

// one year
export const plusGiftDuration = 31557600000;

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;

export const isGiftedPlus = (
  subscriptionFlags: UserSubscriptionFlags,
): subscriptionFlags is UserSubscriptionFlags &
  Required<Pick<UserSubscriptionFlags, 'gifterId' | 'cycle'>> =>
  (!!subscriptionFlags?.gifterId || false) &&
  isPlusMember(subscriptionFlags.cycle);
