import { socialHandleRegex, handleRegex } from '../../src/common/object';

describe('Unicode regex patterns', () => {
  it('socialHandleRegex supports Unicode with optional @ prefix', () => {
    // Valid Unicode handles
    expect(socialHandleRegex.test('@José')).toBe(true);
    expect(socialHandleRegex.test('François-dev')).toBe(true);
    expect(socialHandleRegex.test('北京')).toBe(true);
    expect(socialHandleRegex.test('user_123')).toBe(true);
    expect(socialHandleRegex.test('@' + 'a'.repeat(39))).toBe(true);

    // Invalid handles
    expect(socialHandleRegex.test('')).toBe(false);
    expect(socialHandleRegex.test('a'.repeat(40))).toBe(false);
    expect(socialHandleRegex.test('has space')).toBe(false);
    expect(socialHandleRegex.test('bad!char')).toBe(false);
  });

  it('handleRegex supports Unicode without hyphens', () => {
    // Valid handles (3-39 chars, no hyphens)
    expect(handleRegex.test('abc')).toBe(true);
    expect(handleRegex.test('@user_name')).toBe(true);
    expect(handleRegex.test('Jöhn123')).toBe(true);
    expect(handleRegex.test('@' + 'a'.repeat(39))).toBe(true);

    // Invalid handles
    expect(handleRegex.test('ab')).toBe(false); // too short
    expect(handleRegex.test('François-dev')).toBe(false); // has hyphen
    expect(handleRegex.test('bad handle')).toBe(false); // has space
    expect(handleRegex.test('a'.repeat(40))).toBe(false); // too long
  });
});
