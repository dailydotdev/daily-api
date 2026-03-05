import crypto from 'node:crypto';
import { URL } from 'node:url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { GarmrNoopService, GarmrService } from '../garmr';

const TWITTER_API_BASE_URL = 'https://api.twitter.com';
const TWITTER_UPLOAD_BASE_URL = 'https://upload.twitter.com';

type TwitterCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

type TwitterClient = {
  postTweet: ({
    text,
    mediaIds,
  }: {
    text: string;
    mediaIds?: string[];
  }) => Promise<string>;
  postTweetWithMedia: ({
    text,
    media,
    mediaContentType,
  }: {
    text: string;
    media: Buffer;
    mediaContentType?: string | null;
  }) => Promise<string>;
};

const garmrTwitterService = new GarmrService({
  service: 'twitter',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 3,
    backoff: 2 * 1000,
  },
});

const toPercentEncoded = (value: string): string =>
  encodeURIComponent(value)
    .replace(/\!/g, '%21')
    .replace(/\'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');

const buildOAuthBaseParams = ({
  credentials,
}: {
  credentials: TwitterCredentials;
}): Record<string, string> => ({
  oauth_consumer_key: credentials.consumerKey,
  oauth_nonce: crypto.randomBytes(16).toString('hex'),
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
  oauth_token: credentials.accessToken,
  oauth_version: '1.0',
});

const normalizeParameters = (params: Record<string, string>): string =>
  Object.entries(params)
    .sort(([firstKey, firstValue], [secondKey, secondValue]) => {
      if (firstKey === secondKey) {
        return firstValue.localeCompare(secondValue);
      }

      return firstKey.localeCompare(secondKey);
    })
    .map(
      ([key, value]) =>
        `${toPercentEncoded(key)}=${toPercentEncoded(value || '')}`,
    )
    .join('&');

const buildOAuthAuthorizationHeader = (
  oauthParams: Record<string, string>,
): string => {
  const pairs = Object.entries(oauthParams)
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(
      ([key, value]) =>
        `${toPercentEncoded(key)}="${toPercentEncoded(value || '')}"`,
    );

  return `OAuth ${pairs.join(', ')}`;
};

const signOAuthRequest = ({
  method,
  url,
  credentials,
  queryParams,
  bodyParams,
}: {
  method: 'GET' | 'POST';
  url: string;
  credentials: TwitterCredentials;
  queryParams?: Record<string, string>;
  bodyParams?: Record<string, string>;
}): string => {
  const oauthParams = buildOAuthBaseParams({
    credentials,
  });
  const signatureParams = {
    ...oauthParams,
    ...(queryParams || {}),
    ...(bodyParams || {}),
  };
  const parsedUrl = new URL(url);
  const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
  const baseString = [
    method.toUpperCase(),
    toPercentEncoded(normalizedUrl),
    toPercentEncoded(normalizeParameters(signatureParams)),
  ].join('&');
  const signingKey = `${toPercentEncoded(credentials.consumerSecret)}&${toPercentEncoded(credentials.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  return buildOAuthAuthorizationHeader(oauthParams);
};

const parseJsonResponse = async <T>({
  response,
  context,
}: {
  response: Awaited<ReturnType<typeof fetch>>;
  context: string;
}): Promise<T> => {
  if (!response.ok) {
    throw new Error(
      `${context}: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
};

const uploadMedia = async ({
  credentials,
  media,
  mediaContentType,
  garmr,
}: {
  credentials: TwitterCredentials;
  media: Buffer;
  mediaContentType?: string | null;
  garmr: GarmrService | GarmrNoopService;
}): Promise<string> =>
  garmr.execute(async () => {
    const url = `${TWITTER_UPLOAD_BASE_URL}/1.1/media/upload.json`;
    const authHeader = signOAuthRequest({
      method: 'POST',
      url,
      credentials,
    });
    const form = new FormData();

    form.append('media', media, {
      filename: 'agentic-digest-image.png',
      contentType: mediaContentType || 'image/png',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        ...form.getHeaders(),
      },
      body: form,
    });
    const payload = await parseJsonResponse<{
      media_id_string?: string;
      media_id?: string | number;
    }>({
      response,
      context: 'twitter media upload failed',
    });
    const mediaId = payload.media_id_string || payload.media_id?.toString();

    if (!mediaId) {
      throw new Error('twitter media upload response is missing media id');
    }

    return mediaId;
  });

const createTweet = async ({
  credentials,
  text,
  mediaIds,
  garmr,
}: {
  credentials: TwitterCredentials;
  text: string;
  mediaIds?: string[];
  garmr: GarmrService | GarmrNoopService;
}): Promise<string> =>
  garmr.execute(async () => {
    const url = `${TWITTER_API_BASE_URL}/2/tweets`;
    const authHeader = signOAuthRequest({
      method: 'POST',
      url,
      credentials,
    });
    const body = JSON.stringify({
      text,
      ...(mediaIds?.length
        ? {
            media: {
              media_ids: mediaIds,
            },
          }
        : {}),
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body,
    });
    const payload = await parseJsonResponse<{
      data?: {
        id?: string;
      };
    }>({
      response,
      context: 'twitter tweet create failed',
    });
    const tweetId = payload.data?.id;

    if (!tweetId) {
      throw new Error('twitter tweet create response is missing tweet id');
    }

    return tweetId;
  });

let twitterClient: TwitterClient | null = null;

export const getTwitterClient = (): TwitterClient | null => {
  const credentials = {
    consumerKey: process.env.TWITTER_CONSUMER_KEY || '',
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN_KEY || '',
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
  };

  if (
    !credentials.consumerKey ||
    !credentials.consumerSecret ||
    !credentials.accessToken ||
    !credentials.accessTokenSecret
  ) {
    return null;
  }

  if (!twitterClient) {
    twitterClient = {
      postTweet: async ({ text, mediaIds }) =>
        createTweet({
          credentials,
          text,
          mediaIds,
          garmr: garmrTwitterService,
        }),
      postTweetWithMedia: async ({ text, media, mediaContentType }) => {
        const mediaId = await uploadMedia({
          credentials,
          media,
          mediaContentType,
          garmr: garmrTwitterService,
        });

        return createTweet({
          credentials,
          text,
          mediaIds: [mediaId],
          garmr: garmrTwitterService,
        });
      },
    };
  }

  return twitterClient;
};
