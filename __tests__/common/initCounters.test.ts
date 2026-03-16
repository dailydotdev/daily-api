import { metrics } from '@opentelemetry/api';
import { counters, initCounters } from '../../src/telemetry/metrics';
import { logger } from '../../src/logger';

const mockCounter = { add: jest.fn() };
const mockMeter = { createCounter: jest.fn().mockReturnValue(mockCounter) };

jest.spyOn(metrics, 'getMeter').mockReturnValue(mockMeter as never);

beforeEach(() => {
  for (const key of Object.keys(counters)) {
    delete counters[key as keyof typeof counters];
  }
  mockMeter.createCounter.mockClear();
});

describe('initCounters', () => {
  it('should create counters for the api service', () => {
    initCounters('api');
    expect(counters.api).toBeDefined();
    expect(counters.api?.requests).toBeDefined();
    expect(counters.api?.graphqlOperations).toBeDefined();
    expect(counters.api?.rateLimit).toBeDefined();
  });

  it('should create counters for the background service', () => {
    initCounters('background');
    expect(counters.background).toBeDefined();
    expect(counters.background?.cdcTrigger).toBeDefined();
    expect(counters.background?.postError).toBeDefined();
    expect(counters.background?.notificationFailed).toBeDefined();
  });

  it('should create counters for the cron service', () => {
    initCounters('cron');
    expect(counters.cron).toBeDefined();
    expect(counters.cron?.streakUpdate).toBeDefined();
  });

  it('should create counters for the personalized-digest service', () => {
    initCounters('personalized-digest');
    expect(counters['personalized-digest']).toBeDefined();
    expect(counters['personalized-digest']?.garmrBreak).toBeDefined();
  });

  it('should create counters for the temporal service', () => {
    initCounters('temporal');
    expect(counters.temporal).toBeDefined();
  });

  it('should create counters for the worker-job service', () => {
    initCounters('worker-job');
    expect(counters['worker-job']).toBeDefined();
  });

  it('should warn when given an unrecognized service name', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    initCounters('api-bg' as Parameters<typeof initCounters>[0]);
    expect(warnSpy).toHaveBeenCalledWith(
      { serviceName: 'api-bg' },
      'Unknown service name for counter init',
    );
    expect(counters).toEqual({});
    warnSpy.mockRestore();
  });
});
