import { applyDeterministicVariation } from '../../src/common/number';

describe('applyDeterministicVariation', () => {
  const baseValue = 1000;
  const maxVariationPercent = 7.6;

  it('should return deterministic results for the same seed', () => {
    const seed = 'test-opportunity-id-123';

    const result1 = applyDeterministicVariation({
      value: baseValue,
      seed,
      maxVariationPercent,
    });
    const result2 = applyDeterministicVariation({
      value: baseValue,
      seed,
      maxVariationPercent,
    });

    expect(result1).toBe(result2);
  });

  it('should return different results for different seeds', () => {
    const result1 = applyDeterministicVariation({
      value: baseValue,
      seed: 'completely-different-seed-alpha',
      maxVariationPercent,
    });
    const result2 = applyDeterministicVariation({
      value: baseValue,
      seed: 'another-unique-identifier-beta',
      maxVariationPercent,
    });

    expect(result1).not.toBe(result2);
  });

  it('should return results within the expected range', () => {
    const seeds = [
      'abc',
      'xyz',
      '123',
      'test',
      'opportunity-1',
      'opportunity-2',
      'some-uuid-here',
      'another-id',
      'short',
      'a-very-long-seed-string-to-test-with',
    ];

    const minExpected = Math.round(baseValue * (1 - maxVariationPercent / 100));
    const maxExpected = Math.round(baseValue * (1 + maxVariationPercent / 100));

    seeds.forEach((seed) => {
      const result = applyDeterministicVariation({
        value: baseValue,
        seed,
        maxVariationPercent,
      });

      expect(result).toBeGreaterThanOrEqual(minExpected);
      expect(result).toBeLessThanOrEqual(maxExpected);
    });
  });

  it('should produce both positive and negative variations across different seeds', () => {
    // Use a large set of seeds to statistically ensure we get both positive and negative variations
    const seeds = Array.from({ length: 100 }, (_, i) => `seed-${i}`);

    const results = seeds.map((seed) =>
      applyDeterministicVariation({
        value: baseValue,
        seed,
        maxVariationPercent,
      }),
    );

    const hasPositiveVariation = results.some((r) => r > baseValue);
    const hasNegativeVariation = results.some((r) => r < baseValue);

    expect(hasPositiveVariation).toBe(true);
    expect(hasNegativeVariation).toBe(true);
  });

  it('should return an integer (rounded result)', () => {
    const result = applyDeterministicVariation({
      value: 1000,
      seed: 'test-seed',
      maxVariationPercent: 7.6,
    });

    expect(Number.isInteger(result)).toBe(true);
  });

  it('should scale variation based on maxVariationPercent', () => {
    const seed = 'consistent-seed';

    const result = applyDeterministicVariation({
      value: baseValue,
      seed,
      maxVariationPercent: 15,
    });

    // The deviation from base should be proportionally larger with higher maxVariationPercent
    const deviation = Math.abs(result - baseValue);

    expect(deviation).toBe(34); // Expected deviation for 15% max variation
  });

  it('should handle zero value', () => {
    const result = applyDeterministicVariation({
      value: 0,
      seed: 'any-seed',
      maxVariationPercent: 7.6,
    });

    expect(result).toBe(0);
  });

  it('should return original value when seed is empty', () => {
    const result = applyDeterministicVariation({
      value: baseValue,
      seed: '',
      maxVariationPercent: 7.6,
    });

    // Empty seed should return original value without variation
    expect(result).toBe(baseValue);
  });

  it('should handle falsy value', () => {
    const result = applyDeterministicVariation({
      value: null as unknown as number,
      seed: '',
      maxVariationPercent: 7.6,
    });

    // Empty seed should return original value without variation
    expect(result).toBe(0);
  });
});
