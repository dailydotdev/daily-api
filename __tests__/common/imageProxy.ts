import {
  isAllowedDomain,
  isExternalImageUrl,
  getProxiedImageUrl,
} from '../../src/common/imageProxy';

describe('imageProxy', () => {
  describe('isAllowedDomain', () => {
    it('should return true for media.daily.dev', () => {
      expect(isAllowedDomain('https://media.daily.dev/image.jpg')).toBe(true);
    });

    it('should return true for res.cloudinary.com', () => {
      expect(isAllowedDomain('https://res.cloudinary.com/image.jpg')).toBe(
        true,
      );
    });

    it('should return true for daily-now-res.cloudinary.com', () => {
      expect(
        isAllowedDomain('https://daily-now-res.cloudinary.com/image.jpg'),
      ).toBe(true);
    });

    it('should return true for tenor.com', () => {
      expect(isAllowedDomain('https://tenor.com/image.gif')).toBe(true);
    });

    it('should return true for media.tenor.com subdomain', () => {
      expect(isAllowedDomain('https://media.tenor.com/image.gif')).toBe(true);
    });

    it('should return true for c.tenor.com subdomain', () => {
      expect(isAllowedDomain('https://c.tenor.com/image.gif')).toBe(true);
    });

    it('should return true for giphy.com', () => {
      expect(isAllowedDomain('https://giphy.com/image.gif')).toBe(true);
    });

    it('should return true for media.giphy.com subdomain', () => {
      expect(isAllowedDomain('https://media.giphy.com/image.gif')).toBe(true);
    });

    it('should return true for i.giphy.com subdomain', () => {
      expect(isAllowedDomain('https://i.giphy.com/image.gif')).toBe(true);
    });

    it('should return false for external domains', () => {
      expect(isAllowedDomain('https://example.com/image.jpg')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isAllowedDomain('not-a-url')).toBe(false);
    });
  });

  describe('isExternalImageUrl', () => {
    it('should return false for tenor.com URLs', () => {
      expect(isExternalImageUrl('https://tenor.com/image.gif')).toBe(false);
    });

    it('should return false for media.tenor.com URLs', () => {
      expect(isExternalImageUrl('https://media.tenor.com/image.gif')).toBe(
        false,
      );
    });

    it('should return false for giphy.com URLs', () => {
      expect(isExternalImageUrl('https://giphy.com/image.gif')).toBe(false);
    });

    it('should return false for i.giphy.com URLs', () => {
      expect(isExternalImageUrl('https://i.giphy.com/image.gif')).toBe(false);
    });

    it('should return false for media.giphy.com URLs', () => {
      expect(isExternalImageUrl('https://media.giphy.com/image.gif')).toBe(
        false,
      );
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
    it('should return original URL unchanged for tenor.com', () => {
      const url = 'https://tenor.com/image.gif';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('should return original URL unchanged for media.tenor.com', () => {
      const url = 'https://media.tenor.com/image.gif';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('should return original URL unchanged for giphy.com', () => {
      const url = 'https://giphy.com/image.gif';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('should return original URL unchanged for i.giphy.com', () => {
      const url = 'https://i.giphy.com/image.gif';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('should return original URL unchanged for media.giphy.com', () => {
      const url = 'https://media.giphy.com/image.gif';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('should return original URL unchanged for media.daily.dev', () => {
      const url = 'https://media.daily.dev/image.jpg';
      expect(getProxiedImageUrl(url)).toBe(url);
    });
  });
});
