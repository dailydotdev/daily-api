import {
  personalizedDigestWorkers,
  workers as infraWorkers,
} from '../../.infra/workers';
import {
  typedWorkers,
  workers as legacyWorkers,
} from '../../src/workers/index';

const infraWorkersMap = infraWorkers.reduce(
  (acc, { subscription }) => ({ ...acc, [subscription]: true }),
  {},
);

describe('workers', () => {
  it('should have all subscriptions from typed workers to be defined', () => {
    const allIsFound = legacyWorkers.every(
      ({ subscription }) => subscription in infraWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });

  it('should have all subscriptions from legacy workers to be defined', () => {
    const allIsFound = typedWorkers.every(
      ({ subscription }) => subscription in infraWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });

  it('should have all subscriptions from personalized digest workers to be defined', () => {
    const allIsFound = personalizedDigestWorkers.every(
      ({ subscription }) => subscription in infraWorkersMap,
    );

    expect(allIsFound).toBe(true);
  });
});
