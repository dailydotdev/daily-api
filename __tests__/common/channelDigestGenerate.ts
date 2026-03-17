import nock from 'nock';
import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import { AGENTS_DIGEST_SOURCE, Source } from '../../src/entity/Source';
import { FreeformPost } from '../../src/entity/posts/FreeformPost';
import { generateChannelDigest } from '../../src/common/channelDigest/generate';
import { createSource } from '../fixture/source';

const yggdrasilOrigin = process.env.YGGDRASIL_SENTIMENT_ORIGIN;

if (!yggdrasilOrigin) {
  throw new Error('Missing YGGDRASIL_SENTIMENT_ORIGIN');
}

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
  includeSentiment = false,
  minHighlightScore = null,
  sentimentGroupIds = [],
}: Partial<ChannelDigest> = {}): Promise<ChannelDigest> =>
  con.getRepository(ChannelDigest).save({
    key,
    sourceId,
    channel,
    targetAudience,
    frequency,
    includeSentiment,
    minHighlightScore,
    sentimentGroupIds,
    enabled: true,
  });

const savePost = async ({
  id,
  sourceId = 'content-source',
  title,
  content,
  createdAt,
  channel,
}: {
  id: string;
  sourceId?: string;
  title: string;
  content: string;
  createdAt: Date;
  channel: string;
}) =>
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
  });

describe('generateChannelDigest', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch sentiment for the agentic digest and save the generated post', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    const from = new Date('2026-03-02T10:00:00.000Z').toISOString();

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
      includeSentiment: true,
      minHighlightScore: 0.65,
      sentimentGroupIds: ['group-1', 'group-2'],
    });
    await savePost({
      id: 'post-1',
      title: 'Agentic post',
      content: 'Agentic content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'vibes',
    });

    const scope = nock(yggdrasilOrigin)
      .get('/api/sentiment/highlights')
      .query({
        from,
        group_id: 'group-1',
        min_highlight_score: '0.65',
        order_by: 'recency',
        to: now.toISOString(),
      })
      .reply(200, {
        items: [
          {
            text: 'Worker highlight text',
            author: { handle: 'worker_author' },
            metrics: { like_count: 42 },
          },
        ],
        cursor: null,
      })
      .get('/api/sentiment/highlights')
      .query({
        from,
        group_id: 'group-2',
        min_highlight_score: '0.65',
        order_by: 'recency',
        to: now.toISOString(),
      })
      .reply(200, {
        items: [],
        cursor: null,
      });

    const result = await generateChannelDigest({
      con,
      definition,
      now,
    });

    expect(scope.isDone()).toBe(true);
    expect(result).toMatchObject({
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Mock sentiment digest',
      content: 'Mock digest content',
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
      title: 'Mock sentiment digest',
    });
  });
});
