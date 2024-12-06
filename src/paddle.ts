export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;
