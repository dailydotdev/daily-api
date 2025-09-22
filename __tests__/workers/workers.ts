import {
  workers as infraWorkers,
  personalizedDigestWorkers as infraDigestWorkers,
} from '../../.infra/common';
import {
  typedWorkers,
  workers as legacyWorkers,
  personalizedDigestWorkers,
  notificationWorkers,
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
    const allIsFound = typedWorkers.every(
      ({ subscription }) => subscription in infraWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });

  it('should have all subscriptions from legacy workers to be defined', () => {
    const allIsFound = [...legacyWorkers, ...notificationWorkers].every(
      ({ subscription }) => subscription in infraWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });

  it('should have all subscriptions from personalized digest workers to be defined', () => {
    const allIsFound = personalizedDigestWorkers.every(
      ({ subscription }) => subscription in infraDigestWorkersMap,
    );

    expect(allIsFound).toBe(true);
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
    const allIsFound = infraWorkers.every(
      ({ subscription }) =>
        subscription in typedWorkersMap || subscription in legacyWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });

  it('should have every digest subscriptions to have a digest subscriber worker', () => {
    const allIsFound = infraDigestWorkers.every(
      ({ subscription }) => subscription in personalizedDigestWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });
});
