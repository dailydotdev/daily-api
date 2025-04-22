import { getPrice } from '../../../src/common/paddle/pricing';

describe('getPrice', () => {
  it('should parse USD currency format', () => {
    const result = getPrice({ formatted: '$5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '$5.00',
    });
  });

  it('should parse EUR currency format', () => {
    const result = getPrice({ formatted: '€5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '€5.00',
    });
  });

  it('should parse GBP currency format', () => {
    const result = getPrice({ formatted: '£5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '£5.00',
    });
  });

  it('should parse JPY currency format (no decimals)', () => {
    const result = getPrice({ formatted: '¥500' });
    expect(result).toEqual({
      amount: 500,
      formatted: '¥500',
    });
  });

  it('should parse currency with thousands separator', () => {
    const result = getPrice({ formatted: '$1,234.56' });
    expect(result).toEqual({
      amount: 1234.56,
      formatted: '$1,234.56',
    });
  });

  it('should parse currency with different locale', () => {
    const result = getPrice({ formatted: '1.234,56 €', locale: 'de-DE' });
    expect(result).toEqual({
      amount: 1234.56,
      formatted: '1.234,56 €',
    });
  });

  it('should handle divided amount', () => {
    const result = getPrice({ formatted: '$60.00', divideBy: 12 });
    expect(result).toEqual({
      amount: 5,
      formatted: '$5.00',
    });
  });

  it('should handle divided amount with different locale', () => {
    const result = getPrice({ formatted: '60,00 €', locale: 'fr-FR', divideBy: 12 });
    expect(result).toEqual({
      amount: 5,
      formatted: '5,00 €',
    });
  });

  it('should throw error for invalid currency format', () => {
    expect(() => getPrice({ formatted: 'invalid' })).toThrow('Invalid currency format');
  });

  it('should handle zero amount', () => {
    const result = getPrice({ formatted: '$0.00' });
    expect(result).toEqual({
      amount: 0,
      formatted: '$0.00',
    });
  });

  it('should handle negative amount', () => {
    const result = getPrice({ formatted: '-$5.00' });
    expect(result).toEqual({
      amount: -5,
      formatted: '-$5.00',
    });
  });

  it('should handle currency with space between symbol and amount', () => {
    const result = getPrice({ formatted: '€ 5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '€ 5.00',
    });
  });

  it('should handle currency with space after amount', () => {
    const result = getPrice({ formatted: '5.00 €' });
    expect(result).toEqual({
      amount: 5,
      formatted: '5.00 €',
    });
  });

  it('should handle currency with multiple spaces', () => {
    const result = getPrice({ formatted: '€  5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '€  5.00',
    });
  });

  it('should handle currency with no space between symbol and amount', () => {
    const result = getPrice({ formatted: '€5.00' });
    expect(result).toEqual({
      amount: 5,
      formatted: '€5.00',
    });
  });
}); 