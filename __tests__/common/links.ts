import { isAllowedShortenerUrl, isValidHttpUrl } from '../../src/common';

describe('isValidHttpUrl', () => {
  it('should return true for valid http URL', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true);
  });

  it('should return true for valid https URL', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
  });

  it('should return false for non-http protocols', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('file:///path/to/file')).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidHttpUrl('not-a-url')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});

describe('isAllowedShortenerUrl', () => {
  const originalEnv = process.env.COMMENTS_PREFIX;

  beforeEach(() => {
    process.env.COMMENTS_PREFIX = 'https://app.daily.dev';
  });

  afterEach(() => {
    process.env.COMMENTS_PREFIX = originalEnv;
  });

  it('should allow valid daily.dev URLs', () => {
    expect(isAllowedShortenerUrl('https://app.daily.dev/posts/test')).toBe(
      true,
    );
    expect(isAllowedShortenerUrl('https://app.daily.dev/squads/test')).toBe(
      true,
    );
    expect(isAllowedShortenerUrl('https://app.daily.dev')).toBe(true);
  });

  it('should allow URLs with paths and query parameters', () => {
    expect(
      isAllowedShortenerUrl(
        'https://app.daily.dev/posts/test?userid=123&cid=share_post',
      ),
    ).toBe(true);
    expect(
      isAllowedShortenerUrl('https://app.daily.dev/squads/discover/featured'),
    ).toBe(true);
  });

  it('should reject subdomain spoofing attempts', () => {
    // This is the main attack vector the fix addresses
    expect(
      isAllowedShortenerUrl('https://app.daily.dev.attacker.com/posts/test'),
    ).toBe(false);
    expect(
      isAllowedShortenerUrl('https://app.daily.dev.linkedin.com/posts/test'),
    ).toBe(false);
    expect(
      isAllowedShortenerUrl('https://app.daily.dev.evil.com/posts/test'),
    ).toBe(false);
  });

  it('should reject unrelated domains', () => {
    expect(isAllowedShortenerUrl('https://evil.com/posts/test')).toBe(false);
    expect(isAllowedShortenerUrl('https://google.com')).toBe(false);
    expect(isAllowedShortenerUrl('https://daily.dev.com')).toBe(false);
  });

  it('should reject subdomains of the allowed domain', () => {
    expect(isAllowedShortenerUrl('https://evil.app.daily.dev/posts')).toBe(
      false,
    );
    expect(isAllowedShortenerUrl('https://www.app.daily.dev/posts')).toBe(
      false,
    );
  });

  it('should reject invalid URLs', () => {
    expect(isAllowedShortenerUrl('not-a-url')).toBe(false);
    expect(isAllowedShortenerUrl('')).toBe(false);
    expect(isAllowedShortenerUrl('javascript:alert(1)')).toBe(false);
  });

  it('should return false if COMMENTS_PREFIX is not set', () => {
    delete process.env.COMMENTS_PREFIX;
    expect(isAllowedShortenerUrl('https://app.daily.dev/posts/test')).toBe(
      false,
    );
  });

  it('should return false if COMMENTS_PREFIX is empty', () => {
    process.env.COMMENTS_PREFIX = '';
    expect(isAllowedShortenerUrl('https://app.daily.dev/posts/test')).toBe(
      false,
    );
  });

  it('should handle different protocols correctly', () => {
    expect(isAllowedShortenerUrl('http://app.daily.dev/posts/test')).toBe(true);
    expect(isAllowedShortenerUrl('https://app.daily.dev/posts/test')).toBe(
      true,
    );
  });

  it('should handle ports correctly', () => {
    // Different port should fail since hostname would be app.daily.dev but we're comparing exact
    process.env.COMMENTS_PREFIX = 'https://app.daily.dev:443';
    expect(isAllowedShortenerUrl('https://app.daily.dev/posts/test')).toBe(
      true,
    );
  });
});
