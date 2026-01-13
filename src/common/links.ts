import { Source, SourceType } from '../entity';
import type { Invite, User } from '../entity';
import { Headers } from 'node-fetch';
import { FastifyBaseLogger } from 'fastify';
import { retryFetchParse } from '../integrations/retry';

export const domainAllowedSearchParams = {
  'youtube.com': new Set(['v']), // YouTube video ID
  'developer.apple.com': new Set(['id']), // Apple App Store app ID
  'news.ycombinator.com': new Set(['id']), // Hacker News item ID
  'play.google.com': new Set(['id']), // Google Play Store app ID
};

type AllowedDomain = keyof typeof domainAllowedSearchParams;

export const genericAllowedSearchParams = new Set([
  'sk', // Medium Friend link
]);

export const getDiscussionLink = (postSlug: string, commentId = ''): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postSlug}${
    commentId && `#c-${commentId}`
  }`;

export const getSourceLink = (
  source: Pick<Source, 'handle' | 'type'>,
): string =>
  `${process.env.COMMENTS_PREFIX}/${
    source.type === SourceType.Squad ? 'squads' : 'sources'
  }/${source.handle}`;

export const notificationsLink = `${process.env.COMMENTS_PREFIX}/notifications`;
export const scoutArticleLink = `${process.env.COMMENTS_PREFIX}?scout=true`;
export const squadCreateLink = `${process.env.COMMENTS_PREFIX}?squad=true`;
export const subscribeNotificationsLink = `${process.env.COMMENTS_PREFIX}?notify=true`;
export const generateDevCard = `${process.env.COMMENTS_PREFIX}/devcard`;
export const squadsFeaturedPage = `${process.env.COMMENTS_PREFIX}/squads/discover/featured`;

export const filterExcludedURLSearchParams = (
  params: URLSearchParams,
  allowedSearchParams: Set<string> = genericAllowedSearchParams,
): URLSearchParams => {
  const filteredParams = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    // If the key IS in our set of allowed keys, append it
    if (allowedSearchParams.has(key)) {
      filteredParams.append(key, value);
    }
  }

  return filteredParams;
};

export const deduplicateURLSearchParams = (
  params: URLSearchParams,
): URLSearchParams => {
  const dedupedParams = new URLSearchParams();
  const seenValues = new Map<string, Set<string>>();

  for (const [key, value] of params.entries()) {
    if (!seenValues.has(key)) {
      seenValues.set(key, new Set());
    }

    const currentValue = seenValues.get(key)!;

    // To make sure we remove skip key-value pairs,
    if (currentValue.has(value)) {
      continue;
    }

    currentValue.add(value);
    dedupedParams.append(key, value);
  }

  return dedupedParams;
};

const subtractDomain = (url: string): string | null => {
  const matches = url.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return matches && matches[1];
};

export const standardizeURL = (
  inputUrl: string,
): { url: string; canonicalUrl: string } => {
  const domain = subtractDomain(inputUrl);

  const [canonicalUrl, params] = inputUrl.split('?');
  const searchParams = new URLSearchParams(params);

  const isAllowedDomain = domain && domain in domainAllowedSearchParams;

  const allowedSearchParams = isAllowedDomain
    ? domainAllowedSearchParams[domain as AllowedDomain]
    : genericAllowedSearchParams;

  const filteredParams = filterExcludedURLSearchParams(
    searchParams,
    allowedSearchParams,
  );
  const dedupedParams = deduplicateURLSearchParams(filteredParams);

  let url = canonicalUrl;
  if (dedupedParams.size > 0) {
    url += `?${dedupedParams.toString()}`;
  }

  return {
    url: url,
    canonicalUrl: isAllowedDomain ? url : canonicalUrl,
  };
};

export function isValidHttpUrl(link: string): boolean {
  try {
    const url = new URL(link);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export const domainOnly = (url: string): string => {
  if (!url) return '';

  const { hostname } = new URL(url);

  return hostname.replace(/^www\d?\./, '');
};

type GetInviteLinkProps = {
  referralOrigin: string;
  userId: User['id'];
  token?: Invite['token'];
};
export const getInviteLink = ({
  referralOrigin,
  userId,
  token,
}: GetInviteLinkProps): URL => {
  const campaignUrl = new URL('/join', process.env.COMMENTS_PREFIX);
  campaignUrl.searchParams.append('cid', referralOrigin);
  campaignUrl.searchParams.append('userid', userId);
  if (token) {
    campaignUrl.searchParams.append('ctoken', token);
  }
  return campaignUrl;
};

export const getShortUrl = async (
  url: string,
  log: FastifyBaseLogger,
): Promise<string> => {
  const urlShortenerSecret = process.env.URL_SHORTENER_SECRET;
  const urlShortenerBaseUrl = process.env.URL_SHORTENER_BASE_URL;

  if (!urlShortenerSecret || !urlShortenerBaseUrl) {
    return url;
  }

  const fetchUrl = new URL('/shorten', urlShortenerBaseUrl);
  const headers = new Headers({
    Authorization: `Bearer ${urlShortenerSecret}`,
  });

  try {
    const result = await retryFetchParse<{ url: string }>(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });

    return result.url;
  } catch (err) {
    log.warn({ err }, 'failed to shorten url');
    return url;
  }
};

export const getShortGenericInviteLink = async (
  log: FastifyBaseLogger,
  userId: string,
): Promise<string> => {
  const rawInviteURL = getInviteLink({
    referralOrigin: 'generic',
    userId,
  });
  const genericInviteURL = await getShortUrl(rawInviteURL.toString(), log);
  return genericInviteURL.toString();
};

/**
 * Pattern to match Twitter/X status URLs
 * Matches: twitter.com/user/status/123, x.com/user/status/123
 * With optional www. prefix
 */
export const twitterUrlPattern =
  /^https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i;

/**
 * Check if a URL is a Twitter/X status URL
 */
export const isTwitterUrl = (url: string): boolean => {
  return twitterUrlPattern.test(url);
};

/**
 * Extract tweet ID and username from a Twitter/X URL
 * Returns null if not a valid Twitter URL
 */
export const extractTweetInfo = (
  url: string,
): { tweetId: string; username: string } | null => {
  const match = url.match(twitterUrlPattern);
  if (!match) {
    return null;
  }
  return {
    tweetId: match[3],
    username: match[2],
  };
};

/**
 * Extract just the tweet ID from a Twitter/X URL
 * Returns null if not a valid Twitter URL
 */
export const extractTweetId = (url: string): string | null => {
  const info = extractTweetInfo(url);
  return info?.tweetId || null;
};
