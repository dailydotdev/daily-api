export function largeNumberFormat(value: number): string | null {
  if (typeof value !== 'number') {
    return null;
  }
  let newValue = value;
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let suffixNum = 0;
  while (newValue >= 1000) {
    newValue /= 1000;
    suffixNum += 1;
  }
  if (suffixNum > 0) {
    const remainder = newValue % 1;
    return (
      newValue.toFixed(remainder >= 0 && remainder < 0.05 ? 0 : 1) +
      suffixes[suffixNum]
    );
  }
  return newValue.toString();
}

export const formatCurrency = (
  value: number,
  options?: Intl.NumberFormatOptions,
): string => {
  if (typeof value !== 'number') {
    return '';
  }

  return value.toLocaleString(['en-US'], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
};

export const formatCoresCurrency = (value: number): string | null => {
  if (value > 100_000) {
    return largeNumberFormat(value);
  }

  return formatCurrency(value, {
    minimumFractionDigits: 0,
  });
};

export const coresToUsd = (cores: number): number => {
  return cores / 100; // 100 Cores = 1 USD
};

export const usdToCores = (usd: number): number => {
  return Math.floor(usd * 100); // 1 USD = 100 Cores
};

export const formatMetricValue = (value: number): string | null => {
  if (value > 100_000) {
    return largeNumberFormat(value);
  }

  return formatCurrency(value, {
    minimumFractionDigits: 0,
  });
};

/**
 * Applies a deterministic percentage variation to a value based on a seed string.
 * The same seed will always produce the same variation.
 * Uses djb2 hash algorithm for consistent hashing.
 *
 * @param value - The original value
 * @param seed - A string to seed the variation (e.g., opportunity ID)
 * @param maxVariationPercent - Maximum variation percentage (e.g., 7.6 for ±7.6%)
 * @returns The value with deterministic variation applied, rounded to integer
 */
export const applyDeterministicVariation = ({
  value,
  seed,
  maxVariationPercent,
}: {
  value: number;
  seed: string;
  maxVariationPercent: number;
}): number => {
  if (!seed) {
    return value;
  }

  // djb2 hash algorithm (produces 32-bit signed integers)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash;
  }

  // Normalize hash to range [-1, 1] using the full 32-bit signed integer range
  // 2^31 = 2147483648, so dividing gives us approximately [-1, 1]
  const normalizedHash = hash / 2147483648;

  const variationFactor = 1 + normalizedHash * (maxVariationPercent / 100);

  return Math.round(value * variationFactor);
};
