import { ValidationError } from 'apollo-server-errors';
import { PostType } from '../../src/entity';
import {
  isTwitterSocialType,
  mapTwitterSocialPayload,
} from '../../src/common/twitterSocial';
import twitterSocialThreadPayloadFixture from '../fixture/twitterSocialThreadPayload.json';

describe('isTwitterSocialType', () => {
  it('should return true for social twitter content type', () => {
    expect(isTwitterSocialType(PostType.SocialTwitter)).toBe(true);
  });

  it('should return false for non-twitter content type', () => {
    expect(isTwitterSocialType(PostType.Article)).toBe(false);
  });
});

describe('mapTwitterSocialPayload', () => {
  it('should map thread payload into post fields', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/1',
        extra: {
          sub_type: 'thread',
          content: 'Root tweet',
          thread_tweets: [
            { content: 'Thread item 1' },
            { content: 'Thread item 2' },
          ],
          media: [
            { type: 'image', url: 'https://pbs.twimg.com/media/1.jpg' },
            { type: 'video', url: 'https://video.twimg.com/1.mp4' },
          ],
        },
      },
    });

    expect(payload.fields).toMatchObject({
      type: PostType.SocialTwitter,
      subType: 'thread',
      title: '@user: Root tweet',
      image: 'https://pbs.twimg.com/media/1.jpg',
      videoId: 'https://video.twimg.com/1.mp4',
    });
    expect(payload.fields.content).toContain('Root tweet');
    expect(payload.fields.content).toContain('Thread item 1');
    expect(payload.fields.content).toContain('Thread item 2');
  });

  it('should map provided yggdrasil thread payload into post fields', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        ...twitterSocialThreadPayloadFixture,
        post_id: undefined,
      },
    });

    expect(payload.fields.type).toBe(PostType.SocialTwitter);
    expect(payload.fields.subType).toBe('thread');
    expect(payload.fields.title).toEqual(
      `@${twitterSocialThreadPayloadFixture.extra.author_username}: ${twitterSocialThreadPayloadFixture.extra.content}`,
    );
    expect(payload.fields.image).toEqual(
      'https://pbs.twimg.com/media/G0aidOKbgAIb29j.jpg',
    );
    expect(payload.fields.content).toContain(
      'Elon just revealed exactly how the X algorithm works',
    );
    expect(payload.fields.content).toContain(
      "Let's start with the most controversial part of the X algorithm",
    );
    expect(payload.fields.content).toContain("Tweepcred is X's reputation");
    expect(payload.fields.contentHtml).toContain('<p>');
  });

  it('should extract quote reference from payload', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/2',
        extra: {
          subtype: 'quote',
          content: 'Main quote',
          quoted_tweet: {
            tweet_id: '1999',
            content: 'Referenced quote',
          },
        },
      },
    });

    expect(payload.fields.subType).toBe('quote');
    expect(payload.reference).toMatchObject({
      subType: 'quote',
      url: 'https://x.com/i/web/status/1999',
      title: 'Referenced quote',
    });
  });

  it('should extract repost reference from payload', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/3',
        extra: {
          subtype: 'repost',
          content: 'Main repost',
          reposted_tweet: {
            tweet_id: '3001',
            content: 'Referenced repost',
          },
        },
      },
    });

    expect(payload.fields.subType).toBe('repost');
    expect(payload.reference).toMatchObject({
      subType: 'repost',
      url: 'https://x.com/i/web/status/3001',
      title: 'Referenced repost',
    });
  });

  it('should fallback repost title when body is missing', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/dailydotdev/status/5',
        extra: {
          subtype: 'repost',
        },
      },
    });

    expect(payload.fields).toMatchObject({
      type: PostType.SocialTwitter,
      subType: 'repost',
      title: '@dailydotdev: reposted',
      content: null,
      contentHtml: null,
    });
  });

  it('should normalize retweet subtype into repost', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/dailydotdev/status/8',
        extra: {
          subtype: 'retweet',
        },
      },
    });

    expect(payload.fields).toMatchObject({
      type: PostType.SocialTwitter,
      subType: 'repost',
      title: '@dailydotdev: reposted',
    });
  });

  it('should map plain tweet subtype', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/4',
        extra: {
          subtype: 'tweet',
          content: 'Single tweet content',
          media: [{ type: 'image', url: 'https://pbs.twimg.com/media/t.jpg' }],
        },
      },
    });

    expect(payload.fields).toMatchObject({
      type: PostType.SocialTwitter,
      subType: 'tweet',
      title: '@user: Single tweet content',
      image: 'https://pbs.twimg.com/media/t.jpg',
    });
    expect(payload.fields.content).toBeNull();
  });

  it('should normalize author username for source resolution', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/7',
        extra: {
          subtype: 'tweet',
          content: 'Single tweet content',
          author_username: '@AlexFinn',
        },
      },
    });

    expect(payload.authorUsername).toBe('alexfinn');
  });

  it('should fallback to url handle for source resolution and title', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/DailyDev/status/7',
        extra: {
          subtype: 'tweet',
          content: 'Single tweet content',
        },
      },
    });

    expect(payload.authorUsername).toBe('dailydev');
    expect(payload.fields.title).toBe('@DailyDev: Single tweet content');
  });

  it('should throw validation error for invalid payload', () => {
    expect(() =>
      mapTwitterSocialPayload({
        data: {
          content_type: PostType.SocialTwitter,
          url: '',
        },
      }),
    ).toThrow(ValidationError);
  });
});
