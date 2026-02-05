import {
  isAllowedDomain,
  isExternalImageUrl,
  getProxiedImageUrl,
} from '../../src/common/imageProxy';

describe('imageProxy', () => {
  describe('isAllowedDomain', () => {
    it('should return true for allowed domains and their subdomains', () => {
      // Test main domain and subdomain with one representative example
      expect(isAllowedDomain('https://tenor.com/image.gif')).toBe(true);
      expect(isAllowedDomain('https://media.tenor.com/image.gif')).toBe(true);

      // Test other allowed domains (main domain only - subdomain logic already verified above)
      expect(isAllowedDomain('https://media.daily.dev/image.jpg')).toBe(true);
      expect(isAllowedDomain('https://res.cloudinary.com/image.jpg')).toBe(
        true,
      );
      expect(
        isAllowedDomain('https://daily-now-res.cloudinary.com/image.jpg'),
      ).toBe(true);
      expect(isAllowedDomain('https://giphy.com/image.gif')).toBe(true);
    });

    it('should return false for external domains', () => {
      expect(isAllowedDomain('https://example.com/image.jpg')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isAllowedDomain('not-a-url')).toBe(false);
    });
  });

  describe('isExternalImageUrl', () => {
    it('should return false for allowed domains', () => {
      expect(isExternalImageUrl('https://tenor.com/image.gif')).toBe(false);
      expect(isExternalImageUrl('https://giphy.com/image.gif')).toBe(false);
    });

    it('should return true for external URLs', () => {
      expect(isExternalImageUrl('https://example.com/image.jpg')).toBe(true);
    });

    it('should return false for data URIs', () => {
      expect(isExternalImageUrl('data:image/png;base64,abc')).toBe(false);
    });

    it('should return false for relative URLs', () => {
      expect(isExternalImageUrl('/images/test.jpg')).toBe(false);
    });
  });

  describe('getProxiedImageUrl', () => {
    it('should return original URL unchanged for allowed domains', () => {
      expect(getProxiedImageUrl('https://tenor.com/image.gif')).toBe(
        'https://tenor.com/image.gif',
      );
      expect(getProxiedImageUrl('https://giphy.com/image.gif')).toBe(
        'https://giphy.com/image.gif',
      );
      expect(getProxiedImageUrl('https://media.daily.dev/image.jpg')).toBe(
        'https://media.daily.dev/image.jpg',
      );
    });
  });
});
