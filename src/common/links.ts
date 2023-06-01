import { Source, SourceType } from '../entity';
import fetch, { Headers } from 'node-fetch';

const excludeFromStandardization = [
  'youtube.com',
  'developer.apple.com',
  'news.ycombinator.com',
  'play.google.com',
];

const isExcluded = (url: string) =>
  excludeFromStandardization.some((e) => url.includes(e));

const subtractDomain = (url: string): string => {
  const matches = url.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return matches && matches[1];
};

export const getDiscussionLink = (postId: string, commentId = ''): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postId}${
    commentId && `#c-${commentId}`
  }`;

export const getSourceLink = (
  source: Pick<Source, 'handle' | 'type'>,
): string =>
  `${process.env.COMMENTS_PREFIX}/${
    source.type === SourceType.Squad ? 'squads' : 'sources'
  }/${source.handle}`;

export const scoutArticleLink = `${process.env.COMMENTS_PREFIX}?scout=true`;
export const squadCreateLink = `${process.env.COMMENTS_PREFIX}?squad=true`;
export const subscribeNotificationsLink = `${process.env.COMMENTS_PREFIX}?notify=true`;

export const standardizeURL = (url: string): string => {
  const domain = subtractDomain(url);
  if (!isExcluded(domain)) {
    return url.split('?')[0];
  }

  return url;
};

export function isValidHttpUrl(link: string): boolean {
  try {
    const url = new URL(link);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export const getShortUrl = async (url: string | URL): Promise<string> => {
  const urlShortenerSecret = process.env.URL_SHORTENER_SECRET;
  const urlShortenerBaseUrl = process.env.URL_SHORTENER_BASE_URL;

  if (!urlShortenerSecret || !urlShortenerBaseUrl) {
    return url.toString();
  }

  const fetchUrl = new URL('/shorten', urlShortenerBaseUrl);
  const headers = new Headers({
    Authorization: `Bearer ${urlShortenerSecret}`,
  });

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: url.toString() }),
  });

  if (!response.ok) {
    throw new Error(`Failed to shorten URL, HTTP status ${response.status}}`);
  }

  const result = await response.json();

  return result.url;
};
