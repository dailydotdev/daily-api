import { Source, SourceType } from '../entity';
import type { Invite, User } from '../entity';
import { Headers } from 'node-fetch';
import { FastifyBaseLogger } from 'fastify';
import { retryFetchParse } from '../integrations/retry';

export const excludeFromStandardization = [
  'youtube.com',
  'developer.apple.com',
  'news.ycombinator.com',
  'play.google.com',
];

const isExcluded = (url: string | null) =>
  excludeFromStandardization.some((e) => url?.includes(e));

const subtractDomain = (url: string): string | null => {
  const matches = url.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return matches && matches[1];
};

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

export const domainOnly = (url: string): string => {
  const { hostname } = new URL(url);

  return hostname;
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
