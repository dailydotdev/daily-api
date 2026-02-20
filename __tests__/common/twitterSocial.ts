import { ValidationError } from 'apollo-server-errors';
import { PostType } from '../../src/entity';
import {
  buildTwitterCreatorMeta,
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
      title: 'Root tweet',
      image: 'https://pbs.twimg.com/media/1.jpg',
      videoId: 'https://video.twimg.com/1.mp4',
    });
    expect(payload.authorProfile).toMatchObject({
      handle: 'user',
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
      twitterSocialThreadPayloadFixture.extra.content,
    );
    expect(payload.authorProfile).toEqual({
      handle: 'alexfinn',
      name: 'Alex Finn',
      profileImage:
        'https://pbs.twimg.com/profile_images/1745232634278461440/7gQcr_R__normal.jpg',
    });
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
          reference: {
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
          reference: {
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

  it('should keep repost title empty when body is missing', () => {
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
      title: null,
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
      title: null,
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
      title: 'Single tweet content',
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
    expect(payload.fields.title).toBe('Single tweet content');
  });

  it('should strip leading @mentions from title content', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/bcherny/status/123',
        extra: {
          subtype: 'tweet',
          content:
            '@mikegiannulis I use both Cowork and Claude Code personally',
        },
      },
    });

    expect(payload.fields.title).toBe(
      'I use both Cowork and Claude Code personally',
    );
  });

  it('should strip multiple leading @mentions from title content', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/123',
        extra: {
          subtype: 'tweet',
          content: '@foo @bar @baz actual content here',
        },
      },
    });

    expect(payload.fields.title).toBe('actual content here');
  });

  it('should exclude twitter profile images as post image', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/9',
        image:
          'https://pbs.twimg.com/profile_images/1902044548936953856/J2jeik0t_normal.jpg',
        extra: {
          subtype: 'tweet',
          content: 'Some content',
        },
      },
    });

    expect(payload.fields.image).toBeNull();
  });

  it('should allow non-profile twitter images as post image', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/user/status/10',
        image: 'https://pbs.twimg.com/media/abc123.jpg',
        extra: {
          subtype: 'tweet',
          content: 'Some content',
        },
      },
    });

    expect(payload.fields.image).toBe('https://pbs.twimg.com/media/abc123.jpg');
  });

  it('should extract reference author name and avatar', () => {
    const payload = mapTwitterSocialPayload({
      data: {
        content_type: PostType.SocialTwitter,
        url: 'https://x.com/yacinemtb/status/2024104140285067735',
        extra: {
          sub_type: 'repost',
          content: 'RT @jietang: We just uploaded our GLM-5 tech report',
          author_username: 'yacineMTB',
          author_name: 'kache',
          author_avatar:
            'https://pbs.twimg.com/profile_images/1901438455927668736/FjhhhN0b_normal.jpg',
          reference: {
            tweet_id: '2024054780730171787',
            url: 'https://x.com/jietang/status/2024054780730171787',
            content: 'We just uploaded our GLM-5 tech report onto arxiv.',
            author_username: 'jietang',
            author_name: 'jietang',
            author_avatar:
              'https://pbs.twimg.com/profile_images/2969848274/9650ac94b38c2872eecea8a7dfa376ef_normal.jpeg',
          },
        },
      },
    });

    expect(payload.reference).toMatchObject({
      subType: 'repost',
      authorUsername: 'jietang',
      authorName: 'jietang',
      authorAvatar:
        'https://pbs.twimg.com/profile_images/2969848274/9650ac94b38c2872eecea8a7dfa376ef_normal.jpeg',
    });
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

describe('buildTwitterCreatorMeta', () => {
  it('should build social_twitter contentMeta from author profile', () => {
    const result = buildTwitterCreatorMeta({
      handle: 'jietang',
      name: 'jietang',
      profileImage:
        'https://pbs.twimg.com/profile_images/2969848274/9650ac94b38c2872eecea8a7dfa376ef_normal.jpeg',
    });

    expect(result).toEqual({
      social_twitter: {
        creator: {
          handle: 'jietang',
          name: 'jietang',
          profile_image:
            'https://pbs.twimg.com/profile_images/2969848274/9650ac94b38c2872eecea8a7dfa376ef_normal.jpeg',
        },
      },
    });
  });

  it('should return undefined when no profile fields are set', () => {
    expect(buildTwitterCreatorMeta({})).toBeUndefined();
  });

  it('should omit missing fields from creator meta', () => {
    const result = buildTwitterCreatorMeta({ handle: 'user1' });

    expect(result).toEqual({
      social_twitter: {
        creator: { handle: 'user1' },
      },
    });
  });
});
