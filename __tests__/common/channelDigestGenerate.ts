import type { DataSource } from 'typeorm';
import {
  Pipelines,
  TopicalDigest,
  TopicalDigestItem,
  TopicalDigestRequest,
} from '@dailydotdev/schema';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import {
  AGENTS_DIGEST_SOURCE,
  Source,
  SourceType,
  UNKNOWN_SOURCE,
} from '../../src/entity/Source';
import { FreeformPost } from '../../src/entity/posts/FreeformPost';
import { PostType } from '../../src/entity/posts/Post';
import { SharePost } from '../../src/entity/posts/SharePost';
import { generateChannelDigest } from '../../src/common/channelDigest/generate';
import { createSource } from '../fixture/source';
import * as bragiClients from '../../src/integrations/bragi/clients';
import type { ServiceClient } from '../../src/types';
import { createGarmrMock } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const saveDefinition = async ({
  key = 'agentic',
  sourceId = AGENTS_DIGEST_SOURCE,
  channel = 'vibes',
  targetAudience = 'audience',
  frequency = 'daily',
}: Partial<ChannelDigest> = {}): Promise<ChannelDigest> =>
  con.getRepository(ChannelDigest).save({
    key,
    sourceId,
    channel,
    targetAudience,
    frequency,
    enabled: true,
  });

const savePost = async ({
  id,
  sourceId = 'content-source',
  title,
  content,
  createdAt,
  channel,
  ...overrides
}: {
  id: string;
  sourceId?: string;
  title: string;
  content: string;
  createdAt: Date;
  channel: string;
} & Partial<
  Pick<FreeformPost, 'private' | 'visible' | 'banned' | 'showOnFeed'>
>) =>
  con.getRepository(FreeformPost).save({
    id,
    shortId: id,
    sourceId,
    title,
    content,
    contentHtml: `<p>${content}</p>`,
    createdAt,
    contentMeta: {
      channels: [channel],
    },
    ...overrides,
  });

describe('generateChannelDigest', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should save the generated post when channel posts exist', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');

    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource(
          AGENTS_DIGEST_SOURCE,
          'Agents Digest',
          'https://daily.dev/agents.png',
        ),
      ]);
    const definition = await saveDefinition({
      key: 'agentic',
      sourceId: AGENTS_DIGEST_SOURCE,
      channel: 'vibes',
      targetAudience:
        'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
      frequency: 'daily',
    });
    await savePost({
      id: 'post-1',
      title: 'Agentic post',
      content: 'Agentic content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'vibes',
    });

    const result = await generateChannelDigest({
      con,
      definition,
      now,
    });

    expect(result).toMatchObject({
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Mock topical digest',
      content: [
        '**TLDR:** Mock digest summary',
        '---',
        '## Mock main item',
        'Mock main item body [Read more](http://localhost:5002/posts/post-1)',
        '---',
        '## Also notable',
        '- **Mock notable item:** Mock notable item body',
      ].join('\n\n'),
    });
  });

  it('should return null when there are no matching posts or sentiment items', async () => {
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource('digest-source', 'Digest', 'https://daily.dev/digest.png'),
      ]);
    const definition = await saveDefinition({
      key: 'plain-digest',
      sourceId: 'digest-source',
      channel: 'frontend',
      frequency: 'daily',
    });

    const result = await generateChannelDigest({
      con,
      definition,
      now: new Date('2026-03-03T10:00:00.000Z'),
    });

    expect(result).toBeNull();
  });

  it('should use the weekly fallback window when there is no previous digest', async () => {
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource('weekly-source', 'Weekly', 'https://daily.dev/weekly.png'),
      ]);
    const definition = await saveDefinition({
      key: 'weekly-test',
      sourceId: 'weekly-source',
      channel: 'weekly',
      frequency: 'weekly',
    });
    await savePost({
      id: 'weekly-old',
      title: 'Too old',
      content: 'Outside the weekly window',
      createdAt: new Date('2026-02-23T09:00:00.000Z'),
      channel: 'weekly',
    });

    const outsideWindow = await generateChannelDigest({
      con,
      definition,
      now: new Date('2026-03-03T10:00:00.000Z'),
    });
    expect(outsideWindow).toBeNull();

    await savePost({
      id: 'weekly-new',
      title: 'Inside weekly window',
      content: 'Inside the weekly window',
      createdAt: new Date('2026-02-25T09:00:00.000Z'),
      channel: 'weekly',
    });

    const insideWindow = await generateChannelDigest({
      con,
      definition,
      now: new Date('2026-03-03T10:00:00.000Z'),
    });

    expect(insideWindow).toMatchObject({
      sourceId: 'weekly-source',
      title: 'Mock topical digest',
    });
  });

  it('should send the previous digest markdown and post ids to Bragi', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    let request: TopicalDigestRequest | undefined;

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          generateTopicalDigest: async (data: TopicalDigestRequest) => {
            request = data;

            return new TopicalDigest({
              title: 'New digest',
              tldr: 'New summary',
              mainItems: [
                new TopicalDigestItem({
                  title: 'New item',
                  body: 'New body',
                  postIds: ['new-post'],
                }),
              ],
            });
          },
        } as ServiceClient<typeof Pipelines>['instance'],
        garmr: createGarmrMock(),
      }),
    );

    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource('previous-source', 'Digest', 'https://daily.dev/d.png'),
      ]);
    const definition = await saveDefinition({
      key: 'previous-test',
      sourceId: 'previous-source',
      channel: 'previous',
      frequency: 'daily',
    });
    await con.getRepository(FreeformPost).save({
      id: 'prev-digest',
      shortId: 'prev-digest',
      sourceId: definition.sourceId,
      title: 'Previous digest',
      content: '## Previous item\n\nAlready covered',
      contentHtml: '<h2>Previous item</h2><p>Already covered</p>',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
    });
    await savePost({
      id: 'old-post',
      title: 'Old post',
      content: 'Should be outside the digest window',
      createdAt: new Date('2026-03-03T07:00:00.000Z'),
      channel: 'previous',
    });
    await savePost({
      id: 'new-post',
      title: 'New post',
      content: 'Should be in the digest window',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'previous',
    });

    await generateChannelDigest({
      con,
      definition,
      now,
    });

    expect(request).toEqual(
      new TopicalDigestRequest({
        date: '2026-03-03',
        targetAudience: 'audience',
        frequency: 'daily',
        previousDigestMd: '## Previous item\n\nAlready covered',
        posts: [
          {
            postId: 'new-post',
            title: 'New post',
            summary: 'Should be in the digest window',
          },
        ],
      }),
    );
  });

  it('should remap unknown-source posts to their public SharePost counterpart', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    let request: TopicalDigestRequest | undefined;

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          generateTopicalDigest: async (data: TopicalDigestRequest) => {
            request = data;

            return new TopicalDigest({
              title: 'Remap digest',
              tldr: 'Remap summary',
              mainItems: [
                new TopicalDigestItem({
                  title: 'Remap item',
                  body: 'Remap body',
                  postIds: ['sh-pub'],
                }),
              ],
            });
          },
        } as ServiceClient<typeof Pipelines>['instance'],
        garmr: createGarmrMock(),
      }),
    );

    await con
      .getRepository(Source)
      .save([
        createSource(
          UNKNOWN_SOURCE,
          'Unknown',
          'https://daily.dev/unknown.png',
        ),
        createSource(
          'squad-public',
          'Public Squad',
          'https://daily.dev/sq.png',
        ),
        createSource(
          'remap-digest-source',
          'Digest',
          'https://daily.dev/d.png',
        ),
      ]);
    const definition = await saveDefinition({
      key: 'remap-test',
      sourceId: 'remap-digest-source',
      channel: 'remap',
      frequency: 'daily',
    });
    await savePost({
      id: 'unk-art',
      sourceId: UNKNOWN_SOURCE,
      title: 'Unknown article',
      content: 'Article content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'remap',
    });
    await con.getRepository(SharePost).save({
      id: 'sh-pub',
      shortId: 'sh-pub',
      sourceId: 'squad-public',
      type: PostType.Share,
      sharedPostId: 'unk-art',
      visible: true,
      private: false,
      showOnFeed: true,
      deleted: false,
      banned: false,
      createdAt: new Date('2026-03-03T09:30:00.000Z'),
    });

    const result = await generateChannelDigest({ con, definition, now });

    expect(request?.posts.map((post) => post.postId)).toEqual(['sh-pub']);
    expect(request?.posts[0]).toMatchObject({
      title: 'Unknown article',
      summary: 'Article content',
    });
    expect(result?.content).toContain(
      '[Read more](http://localhost:5002/posts/sh-pub)',
    );
  });

  it('should drop unknown-source posts when no public SharePost exists', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    let request: TopicalDigestRequest | undefined;

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          generateTopicalDigest: async (data: TopicalDigestRequest) => {
            request = data;

            return new TopicalDigest({
              title: 'Keep digest',
              tldr: 'Keep summary',
              mainItems: [
                new TopicalDigestItem({
                  title: 'Keep item',
                  body: 'Keep body',
                  postIds: ['orph-art'],
                }),
              ],
            });
          },
        } as ServiceClient<typeof Pipelines>['instance'],
        garmr: createGarmrMock(),
      }),
    );

    await con
      .getRepository(Source)
      .save([
        createSource(
          UNKNOWN_SOURCE,
          'Unknown',
          'https://daily.dev/unknown.png',
        ),
        createSource('keep-digest-source', 'Digest', 'https://daily.dev/d.png'),
      ]);
    const definition = await saveDefinition({
      key: 'keep-test',
      sourceId: 'keep-digest-source',
      channel: 'keep',
      frequency: 'daily',
    });
    await savePost({
      id: 'orph-art',
      sourceId: UNKNOWN_SOURCE,
      title: 'Orphan article',
      content: 'Orphan content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'keep',
      private: true,
    });

    const result = await generateChannelDigest({ con, definition, now });

    expect(request).toBeUndefined();
    expect(result).toBeNull();
  });

  it('should drop unknown-source posts when the only share is private', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    let request: TopicalDigestRequest | undefined;

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          generateTopicalDigest: async (data: TopicalDigestRequest) => {
            request = data;

            return new TopicalDigest({
              title: 'Private share digest',
              tldr: 'Private share summary',
              mainItems: [],
            });
          },
        } as ServiceClient<typeof Pipelines>['instance'],
        garmr: createGarmrMock(),
      }),
    );

    await con
      .getRepository(Source)
      .save([
        createSource(
          UNKNOWN_SOURCE,
          'Unknown',
          'https://daily.dev/unknown.png',
        ),
        createSource(
          'squad-private',
          'Private Squad',
          'https://daily.dev/sq.png',
          SourceType.Squad,
          true,
        ),
        createSource(
          'private-share-digest-source',
          'Digest',
          'https://daily.dev/d.png',
        ),
      ]);
    const definition = await saveDefinition({
      key: 'private-share-test',
      sourceId: 'private-share-digest-source',
      channel: 'private-share',
      frequency: 'daily',
    });
    await savePost({
      id: 'unk-priv',
      sourceId: UNKNOWN_SOURCE,
      title: 'Unknown article',
      content: 'Article content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'private-share',
      private: true,
    });
    await con.getRepository(SharePost).save({
      id: 'sh-priv',
      shortId: 'sh-priv',
      sourceId: 'squad-private',
      type: PostType.Share,
      sharedPostId: 'unk-priv',
      visible: true,
      private: true,
      showOnFeed: true,
      deleted: false,
      banned: false,
      createdAt: new Date('2026-03-03T09:30:00.000Z'),
    });

    const result = await generateChannelDigest({ con, definition, now });

    expect(request).toBeUndefined();
    expect(result).toBeNull();
  });

  it('should exclude private, banned, invisible and hidden posts from candidates', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    let request: TopicalDigestRequest | undefined;

    jest.spyOn(bragiClients, 'getBragiClient').mockImplementation(
      (): ServiceClient<typeof Pipelines> => ({
        instance: {
          generateTopicalDigest: async (data: TopicalDigestRequest) => {
            request = data;

            return new TopicalDigest({
              title: 'Filtered digest',
              tldr: 'Filtered summary',
              mainItems: [
                new TopicalDigestItem({
                  title: 'Filtered item',
                  body: 'Filtered body',
                  postIds: ['acc-post'],
                }),
              ],
            });
          },
        } as ServiceClient<typeof Pipelines>['instance'],
        garmr: createGarmrMock(),
      }),
    );

    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource(
          'filtered-digest-source',
          'Digest',
          'https://daily.dev/d.png',
        ),
      ]);
    const definition = await saveDefinition({
      key: 'filtered-test',
      sourceId: 'filtered-digest-source',
      channel: 'filtered',
      frequency: 'daily',
    });
    const createdAt = new Date('2026-03-03T09:00:00.000Z');
    await savePost({
      id: 'acc-post',
      title: 'Accessible post',
      content: 'Accessible content',
      createdAt,
      channel: 'filtered',
    });
    await savePost({
      id: 'priv-post',
      title: 'Private post',
      content: 'Private content',
      createdAt,
      channel: 'filtered',
      private: true,
    });
    await savePost({
      id: 'ban-post',
      title: 'Banned post',
      content: 'Banned content',
      createdAt,
      channel: 'filtered',
      banned: true,
    });
    await savePost({
      id: 'inv-post',
      title: 'Invisible post',
      content: 'Invisible content',
      createdAt,
      channel: 'filtered',
      visible: false,
    });
    await savePost({
      id: 'hid-post',
      title: 'Hidden post',
      content: 'Hidden content',
      createdAt,
      channel: 'filtered',
      showOnFeed: false,
    });

    await generateChannelDigest({ con, definition, now });

    expect(request?.posts.map((post) => post.postId)).toEqual(['acc-post']);
  });
});
