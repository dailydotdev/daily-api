import { z } from 'zod';

const socialUrlSchema = (regex: RegExp) =>
  z.preprocess(
    (val) => (val === '' ? null : val),
    z
      .string()
      .regex(regex)
      .transform((val) => {
        const match = val.match(regex);
        return match?.groups?.value ?? val;
      })
      .nullish(),
  );

export const roadmapSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?roadmap\.sh\/u\/)?(?<value>[\w-]{2,})\/?$/,
);

export const twitterSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?(?:twitter|x)\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const githubSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?github\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const threadsSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?threads\.net\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const codepenSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?codepen\.io\/)?(?<value>[\w-]{2,})\/?$/,
);

export const redditSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?reddit\.com\/(?:u|user)\/)?(?<value>[\w-]{2,})\/?$/,
);

export const stackoverflowSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?stackoverflow\.com\/users\/)?(?<value>\d+\/[\w-]+)\/?$/,
);

export const youtubeSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?youtube\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const linkedinSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?linkedin\.com\/in\/)?(?<value>[\p{L}\p{N}_-]{2,})\/?$/u,
);

export const mastodonSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\/@[\w-]{2,}\/?)$/,
);

export const hashnodeSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]{1,50}\.){0,5}[a-z0-9-]{1,50}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_+.~#?&\/=]*))$/,
);

export const portfolioSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]{1,50}\.){0,5}[a-z0-9-]{1,50}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_+.~#?&\/=]*))$/,
);

export const blueskySchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?bsky\.app\/profile\/)?(?<value>[\w.-]+)(?:\/.*)?$/,
);

export const socialFieldsSchema = z.object({
  github: githubSchema,
  twitter: twitterSchema,
  threads: threadsSchema,
  codepen: codepenSchema,
  reddit: redditSchema,
  stackoverflow: stackoverflowSchema,
  youtube: youtubeSchema,
  linkedin: linkedinSchema,
  mastodon: mastodonSchema,
  roadmap: roadmapSchema,
  bluesky: blueskySchema,
  hashnode: hashnodeSchema,
  portfolio: portfolioSchema,
});

export type SocialFields = z.infer<typeof socialFieldsSchema>;

/**
 * Domain-to-platform mapping for auto-detection
 */
const PLATFORM_DOMAINS: Record<string, string> = {
  'linkedin.com': 'linkedin',
  'github.com': 'github',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'threads.net': 'threads',
  'bsky.app': 'bluesky',
  'roadmap.sh': 'roadmap',
  'codepen.io': 'codepen',
  'reddit.com': 'reddit',
  'stackoverflow.com': 'stackoverflow',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'hashnode.com': 'hashnode',
  'hashnode.dev': 'hashnode',
};

/**
 * Detect platform from a URL
 * @param url - Full URL to detect platform from
 * @returns Platform identifier or null if not detected
 */
export function detectPlatformFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^(www\.|m\.)/, '');

    // Check for exact matches first
    if (PLATFORM_DOMAINS[hostname]) {
      return PLATFORM_DOMAINS[hostname];
    }

    // Check for partial matches (subdomains like mastodon instances)
    for (const [domain, platform] of Object.entries(PLATFORM_DOMAINS)) {
      if (hostname.endsWith(`.${domain}`) || hostname === domain) {
        return platform;
      }
    }

    // Special handling for mastodon instances (format: instance/@username)
    if (hostname.match(/^[a-z0-9-]+\.[a-z]{2,}$/) && url.includes('/@')) {
      return 'mastodon';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Schema for a single social link input
 */
export const socialLinkInputSchema = z.object({
  url: z.string().url(),
  platform: z.string().optional(),
});

/**
 * Schema for socialLinks array input with auto-detection and transformation
 */
export const socialLinksInputSchema = z
  .array(socialLinkInputSchema)
  .transform((links) =>
    links.map(({ url, platform }) => ({
      platform: platform || detectPlatformFromUrl(url) || 'other',
      url,
    })),
  );

export type SocialLinkInput = z.input<typeof socialLinkInputSchema>;
export type SocialLink = z.output<typeof socialLinksInputSchema>[number];

/**
 * Extract handle or identifier from a social link URL
 * Returns null if URL is invalid or doesn't match expected format
 */
export function extractHandleFromUrl(
  url: string,
  platform: string,
): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash

    switch (platform) {
      case 'twitter':
        // https://x.com/username or https://twitter.com/username
        return pathname.replace(/^\//, '').replace('@', '') || null;
      case 'github':
        // https://github.com/username
        return pathname.replace(/^\//, '') || null;
      case 'linkedin':
        // https://linkedin.com/in/username
        return pathname.replace(/^\/in\//, '') || null;
      case 'threads':
        // https://threads.net/@username
        return pathname.replace(/^\/@?/, '') || null;
      case 'roadmap':
        // https://roadmap.sh/u/username
        return pathname.replace(/^\/u\//, '') || null;
      case 'codepen':
        // https://codepen.io/username
        return pathname.replace(/^\//, '') || null;
      case 'reddit':
        // https://reddit.com/u/username or /user/username
        return pathname.replace(/^\/(u|user)\//, '') || null;
      case 'stackoverflow':
        // https://stackoverflow.com/users/123/username
        return pathname.replace(/^\/users\//, '') || null;
      case 'youtube':
        // https://youtube.com/@username
        return pathname.replace(/^\/@?/, '') || null;
      case 'bluesky':
        // https://bsky.app/profile/username.bsky.social
        return pathname.replace(/^\/profile\//, '') || null;
      case 'mastodon':
        // Full URL is stored for mastodon
        return url;
      case 'hashnode':
        // https://hashnode.com/@username
        return pathname.replace(/^\/@?/, '') || null;
      case 'portfolio':
        // Full URL is stored for portfolio
        return url;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
