export enum PostLifecycleStateValue {
  Breakout = 'breakout',
  Evergreen = 'evergreen',
}

export const TRACKED_LIFECYCLE_STATES: ReadonlyArray<PostLifecycleStateValue> =
  [PostLifecycleStateValue.Breakout, PostLifecycleStateValue.Evergreen];
