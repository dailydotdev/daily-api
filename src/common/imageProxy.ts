import cloudinary from 'cloudinary';
import { mapCloudinaryUrl } from './cloudinary';

/**
 * Allowed domains that don't need proxying (already hosted by us)
 */
const ALLOWED_DOMAINS = [
  'media.daily.dev',
  'res.cloudinary.com',
  'daily-now-res.cloudinary.com',
];

/**
 * Private/internal IP ranges that should be blocked (SSRF prevention)
 */
const PRIVATE_IP_PATTERNS = [
  // IPv4 private ranges
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  // IPv4 link-local
  /^169\.254\./,
  // Localhost variations
  /^0\.0\.0\.0/,
  /^localhost$/i,
  // IPv6 loopback and private
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

/**
 * Maximum URL length to prevent abuse
 */
const MAX_URL_LENGTH = 2048;

/**
 * Checks if a hostname is a private/internal IP address
 */
export function isPrivateIP(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Checks if a URL is from an allowed domain that doesn't need proxying
 */
export function isAllowedDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/**
 * Validates that a URL is safe to proxy
 * Returns an error message if invalid, or null if valid
 */
export function validateImageUrl(url: string): string | null {
  // Check URL length
  if (url.length > MAX_URL_LENGTH) {
    return 'URL exceeds maximum length';
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return 'Only HTTP and HTTPS protocols are allowed';
    }

    // Block private/internal IP addresses (SSRF prevention)
    if (isPrivateIP(parsedUrl.hostname)) {
      return 'Private IP addresses are not allowed';
    }

    return null;
  } catch {
    return 'Invalid URL format';
  }
}

/**
 * Checks if a URL is an external image URL that needs proxying
 * Returns true for external http/https URLs, false for everything else
 * (data URIs, relative URLs, and allowed domains)
 *
 * Note: Invalid protocols like file:// are NOT considered external URLs.
 * They are handled by validateImageUrl which rejects them.
 */
export function isExternalImageUrl(url: string): boolean {
  // Skip data URIs
  if (url.startsWith('data:')) {
    return false;
  }

  // Only consider http/https URLs as external (relative URLs and other protocols are skipped)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // Skip URLs from allowed domains
  if (isAllowedDomain(url)) {
    return false;
  }

  return true;
}

/**
 * Generates a signed Cloudinary fetch URL for proxying an external image
 *
 * Uses Cloudinary's fetch feature with signed URLs to:
 * 1. Cache the image on Cloudinary's CDN
 * 2. Prevent direct requests from users to external servers (IP privacy)
 * 3. Apply automatic format and quality optimization
 *
 * @param externalUrl The external image URL to proxy
 * @returns The signed Cloudinary fetch URL, or null if the URL is invalid/blocked
 */
export function getProxiedImageUrl(externalUrl: string): string | null {
  // Skip if not an external URL
  if (!isExternalImageUrl(externalUrl)) {
    return externalUrl;
  }

  // Validate the URL
  const validationError = validateImageUrl(externalUrl);
  if (validationError) {
    return null;
  }

  // Skip if Cloudinary is not configured
  if (!process.env.CLOUDINARY_URL) {
    return externalUrl;
  }

  try {
    // Generate a signed Cloudinary fetch URL
    const cloudinaryUrl = cloudinary.v2.url(externalUrl, {
      type: 'fetch',
      sign_url: true,
      secure: true,
      fetch_format: 'auto',
      quality: 'auto',
    });

    // Map to media.daily.dev domain
    return mapCloudinaryUrl(cloudinaryUrl);
  } catch {
    // If Cloudinary URL generation fails, return original URL
    // to avoid breaking the content
    return externalUrl;
  }
}

/**
 * Processes HTML content to proxy all external image URLs
 * This is used as a fallback for content that wasn't processed during markdown rendering
 *
 * @param html The HTML content containing images
 * @returns The HTML with external image URLs replaced with proxied URLs
 */
export function proxyImagesInHtml(html: string): string {
  if (!html) {
    return html;
  }

  // Match img tags and replace src attributes
  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      const proxiedUrl = getProxiedImageUrl(src);
      if (proxiedUrl && proxiedUrl !== src) {
        return `<img ${before}src="${proxiedUrl}"${after}>`;
      }
      return match;
    },
  );
}
