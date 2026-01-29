import {
  workers as infraWorkers,
  personalizedDigestWorkers as infraDigestWorkers,
} from '../../.infra/common';
import {
  typedWorkers,
  workers as legacyWorkers,
  personalizedDigestWorkers,
} from '../../src/workers/index';

const infraWorkersMap = infraWorkers.reduce(
  (acc, { subscription }) => ({ ...acc, [subscription]: true }),
  {},
);

const infraDigestWorkersMap = infraDigestWorkers.reduce(
  (acc, { subscription }) => ({ ...acc, [subscription]: true }),
  {},
);

describe('pubsub workers', () => {
  it('should have all subscriptions from typed workers to be defined', () => {
    const missing = typedWorkers
      .filter(({ subscription }) => !(subscription in infraWorkersMap))
      .map(({ subscription }) => subscription);

    expect(missing).toEqual([]);
  });

  it('should have all subscriptions from legacy workers to be defined', () => {
    const missing = legacyWorkers
      .filter(({ subscription }) => !(subscription in infraWorkersMap))
      .map(({ subscription }) => subscription);

    expect(missing).toEqual([]);
  });

  it('should have all subscriptions from personalized digest workers to be defined', () => {
    const missing = personalizedDigestWorkers
      .filter(({ subscription }) => !(subscription in infraDigestWorkersMap))
      .map(({ subscription }) => subscription);

    expect(missing).toEqual([]);
  });
});

describe('infra subscriptions', () => {
  const typedWorkersMap = typedWorkers.reduce(
    (acc, { subscription }) => ({ ...acc, [subscription]: true }),
    {},
  );

  const legacyWorkersMap = legacyWorkers.reduce(
    (acc, { subscription }) => ({ ...acc, [subscription]: true }),
    {},
  );

  const personalizedDigestWorkersMap = personalizedDigestWorkers.reduce(
    (acc, { subscription }) => ({ ...acc, [subscription]: true }),
    {},
  );

  it('should have every subscriptions to have a subscriber worker', () => {
    const missing = infraWorkers
      .filter(
        ({ subscription }) =>
          !(
            subscription in typedWorkersMap || subscription in legacyWorkersMap
          ),
      )
      .map(({ subscription }) => subscription);

    expect(missing).toEqual([]);
  });

  it('should have every digest subscriptions to have a digest subscriber worker', () => {
    const missing = infraDigestWorkers
      .filter(
        ({ subscription }) => !(subscription in personalizedDigestWorkersMap),
      )
      .map(({ subscription }) => subscription);

    expect(missing).toEqual([]);
  });
});
