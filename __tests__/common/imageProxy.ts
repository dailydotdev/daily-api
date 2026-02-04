import cloudinary from 'cloudinary';
import {
  isPrivateIP,
  isAllowedDomain,
  validateImageUrl,
  isExternalImageUrl,
  getProxiedImageUrl,
} from '../../src/common/imageProxy';

const configureCloudinary = () => {
  cloudinary.v2.config({
    cloud_name: 'daily-now',
    api_key: 'test',
    api_secret: 'test',
  });
};

describe('imageProxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isPrivateIP', () => {
    it('should return true for localhost', () => {
      expect(isPrivateIP('localhost')).toBe(true);
    });

    it('should return true for 127.0.0.1', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('should return true for 127.x.x.x addresses', () => {
      expect(isPrivateIP('127.0.0.255')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should return true for 10.x.x.x private addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('should return true for 192.168.x.x private addresses', () => {
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should return true for 172.16-31.x.x private addresses', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('should return false for 172.15.x.x (not private)', () => {
      expect(isPrivateIP('172.15.0.1')).toBe(false);
    });

    it('should return false for 172.32.x.x (not private)', () => {
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should return true for link-local 169.254.x.x', () => {
      expect(isPrivateIP('169.254.0.1')).toBe(true);
    });

    it('should return true for 0.0.0.0', () => {
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should return true for IPv6 loopback ::1', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should return true for IPv6 link-local fe80:', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should return true for IPv6 private fc00:', () => {
      expect(isPrivateIP('fc00::1')).toBe(true);
    });

    it('should return true for IPv6 private fd00:', () => {
      expect(isPrivateIP('fd00::1')).toBe(true);
    });

    it('should return false for public IP addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('142.250.185.238')).toBe(false);
    });

    it('should return false for public domain names', () => {
      expect(isPrivateIP('example.com')).toBe(false);
      expect(isPrivateIP('google.com')).toBe(false);
    });
  });

  describe('isAllowedDomain', () => {
    it('should return true for media.daily.dev', () => {
      expect(isAllowedDomain('https://media.daily.dev/image.png')).toBe(true);
    });

    it('should return true for res.cloudinary.com', () => {
      expect(
        isAllowedDomain(
          'https://res.cloudinary.com/daily-now/image/upload/image.png',
        ),
      ).toBe(true);
    });

    it('should return true for daily-now-res.cloudinary.com', () => {
      expect(
        isAllowedDomain(
          'https://daily-now-res.cloudinary.com/image/upload/image.png',
        ),
      ).toBe(true);
    });

    it('should return false for external domains', () => {
      expect(isAllowedDomain('https://example.com/image.png')).toBe(false);
      expect(isAllowedDomain('https://evil.com/track.gif')).toBe(false);
    });

    it('should return false for spoofed domains', () => {
      expect(
        isAllowedDomain('https://media.daily.dev.evil.com/image.png'),
      ).toBe(false);
      expect(
        isAllowedDomain('https://evil.com/media.daily.dev/image.png'),
      ).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isAllowedDomain('not-a-url')).toBe(false);
      expect(isAllowedDomain('')).toBe(false);
    });
  });

  describe('validateImageUrl', () => {
    it('should return null for valid HTTP URLs', () => {
      expect(validateImageUrl('http://example.com/image.png')).toBeNull();
      expect(validateImageUrl('https://example.com/image.png')).toBeNull();
    });

    it('should return error for URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      expect(validateImageUrl(longUrl)).toBe('URL exceeds maximum length');
    });

    it('should return error for private IP addresses', () => {
      expect(validateImageUrl('http://127.0.0.1/image.png')).toBe(
        'Private IP addresses are not allowed',
      );
      expect(validateImageUrl('http://10.0.0.1/image.png')).toBe(
        'Private IP addresses are not allowed',
      );
      expect(validateImageUrl('http://192.168.1.1/image.png')).toBe(
        'Private IP addresses are not allowed',
      );
      expect(validateImageUrl('http://localhost/image.png')).toBe(
        'Private IP addresses are not allowed',
      );
    });

    it('should return error for invalid URL format', () => {
      expect(validateImageUrl('not-a-url')).toBe('Invalid URL format');
      expect(validateImageUrl('')).toBe('Invalid URL format');
    });
  });

  describe('isExternalImageUrl', () => {
    it('should return false for data URIs', () => {
      expect(isExternalImageUrl('data:image/png;base64,abc123')).toBe(false);
    });

    it('should return false for relative URLs', () => {
      expect(isExternalImageUrl('/images/logo.png')).toBe(false);
      expect(isExternalImageUrl('./image.png')).toBe(false);
      expect(isExternalImageUrl('image.png')).toBe(false);
    });

    it('should return false for allowed domains', () => {
      expect(isExternalImageUrl('https://media.daily.dev/image.png')).toBe(
        false,
      );
      expect(
        isExternalImageUrl(
          'https://res.cloudinary.com/daily-now/image/upload/image.png',
        ),
      ).toBe(false);
    });

    it('should return true for external HTTP URLs', () => {
      expect(isExternalImageUrl('http://example.com/image.png')).toBe(true);
      expect(isExternalImageUrl('https://evil.com/track.gif')).toBe(true);
    });
  });

  describe('getProxiedImageUrl', () => {
    beforeEach(() => {
      process.env.CLOUDINARY_URL = 'cloudinary://test:test@daily-now';
      configureCloudinary();
    });

    it('should return original URL for data URIs', () => {
      const dataUri = 'data:image/png;base64,abc123';
      expect(getProxiedImageUrl(dataUri)).toBe(dataUri);
    });

    it('should return original URL for allowed domains', () => {
      const allowedUrl = 'https://media.daily.dev/image.png';
      expect(getProxiedImageUrl(allowedUrl)).toBe(allowedUrl);
    });

    it('should return null for private IP URLs', () => {
      expect(getProxiedImageUrl('http://127.0.0.1/image.png')).toBeNull();
      expect(getProxiedImageUrl('http://localhost/image.png')).toBeNull();
    });

    it('should return original URL for non-http protocols (file://, ftp://)', () => {
      // Non-http protocols are not considered external URLs and pass through
      // They won't work in browser context anyway
      expect(getProxiedImageUrl('file:///etc/passwd')).toBe(
        'file:///etc/passwd',
      );
      expect(getProxiedImageUrl('ftp://example.com/image.png')).toBe(
        'ftp://example.com/image.png',
      );
    });

    it('should return original URL when Cloudinary is not configured', () => {
      delete process.env.CLOUDINARY_URL;
      const externalUrl = 'https://example.com/image.png';
      expect(getProxiedImageUrl(externalUrl)).toBe(externalUrl);
    });

    it('should transform external URLs to Cloudinary fetch URLs', () => {
      const externalUrl = 'https://example.com/image.png';
      const result = getProxiedImageUrl(externalUrl);

      expect(result).not.toBeNull();
      expect(result).toContain('media.daily.dev');
      expect(result).toContain('/image/fetch/');
      // Should contain signature
      expect(result).toMatch(/s--[A-Za-z0-9_-]+--/);
    });
  });
});
