import { isNaN } from 'lodash';

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

export const formatNumber = (
  value: number | string | undefined,
): number | undefined => {
  if (isNaN(Number(value))) {
    return undefined;
  }

  return Number(value);
};
