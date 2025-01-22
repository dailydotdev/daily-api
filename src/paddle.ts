export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export const subscriptionGiftDuration = 31557600000;

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;
