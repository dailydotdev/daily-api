import { DataSource, IsNull } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ArticlePost, Source } from '../../src/entity';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../../src/entity/PostHighlight';
import { PostType } from '../../src/entity/posts/Post';
import { sourcesFixture } from '../fixture/source';
import { saveFixtures } from '../helpers';
import { replaceHighlightsForChannel } from '../../src/common/channelHighlight/publish';
import type { HighlightItem } from '../../src/common/channelHighlight/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const NOW = new Date('2026-03-20T12:00:00.000Z');

const createTestPosts = async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(ArticlePost).save(
    ['p1', 'p2', 'p3', 'p4'].map((id, i) => ({
      id,
      shortId: id,
      title: `Post ${i + 1}`,
      url: `https://example.com/${id}`,
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date(NOW.getTime() - (4 - i) * 3600_000),
      type: PostType.Article,
      metadataChangedAt: new Date(NOW.getTime() - (4 - i) * 3600_000),
    })),
  );
};

beforeEach(async () => {
  await con.getRepository(PostHighlight).delete({});
  await con.getRepository(ArticlePost).delete(['p1', 'p2', 'p3', 'p4']);
  await con.getRepository(Source).delete(['a', 'b', 'c']);
});

const makeItem = (
  postId: string,
  headline: string,
  overrides?: Partial<HighlightItem>,
): HighlightItem => ({
  postId,
  headline,
  highlightedAt: NOW,
  significanceLabel: 'notable',
  reason: null,
  ...overrides,
});

describe('replaceHighlightsForChannel', () => {
  it('should insert new highlights', async () => {
    await createTestPosts();

    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Headline 1'), makeItem('p2', 'Headline 2')],
      });
    });

    const rows = await con.getRepository(PostHighlight).find({
      where: { channel: 'test-ch' },
      order: { postId: 'ASC' },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      postId: 'p1',
      headline: 'Headline 1',
      retiredAt: null,
    });
    expect(rows[1]).toMatchObject({
      postId: 'p2',
      headline: 'Headline 2',
      retiredAt: null,
    });
  });

  it('should retire highlights no longer in the set', async () => {
    await createTestPosts();

    // Initial publish with p1 and p2
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Headline 1'), makeItem('p2', 'Headline 2')],
      });
    });

    // Second publish with only p2
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p2', 'Updated Headline 2')],
      });
    });

    const all = await con.getRepository(PostHighlight).find({
      where: { channel: 'test-ch' },
      order: { postId: 'ASC' },
    });

    expect(all).toHaveLength(2);
    // p1 should be retired
    expect(all[0]).toMatchObject({ postId: 'p1' });
    expect(all[0].retiredAt).not.toBeNull();
    // p2 should still be active
    expect(all[1]).toMatchObject({
      postId: 'p2',
      headline: 'Updated Headline 2',
      retiredAt: null,
    });
  });

  it('should re-admit a previously retired post without duplicate key error', async () => {
    await createTestPosts();

    // Step 1: publish p1 and p2
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Headline 1'), makeItem('p2', 'Headline 2')],
      });
    });

    // Step 2: publish only p2 → p1 becomes retired
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p2', 'Headline 2')],
      });
    });

    // Verify p1 is retired
    const retired = await con.getRepository(PostHighlight).findOne({
      where: { channel: 'test-ch', postId: 'p1' },
    });
    expect(retired!.retiredAt).not.toBeNull();

    // Step 3: re-admit p1 — this was the bug: would throw duplicate key error
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [
          makeItem('p1', 'Re-admitted Headline 1'),
          makeItem('p2', 'Headline 2'),
        ],
      });
    });

    const reAdmitted = await con.getRepository(PostHighlight).findOne({
      where: { channel: 'test-ch', postId: 'p1' },
    });

    expect(reAdmitted).toBeDefined();
    expect(reAdmitted!.retiredAt).toBeNull();
    expect(reAdmitted!.headline).toBe('Re-admitted Headline 1');
    // Should reuse the same row (same id)
    expect(reAdmitted!.id).toBe(retired!.id);
  });

  it('should not affect highlights in other channels', async () => {
    await createTestPosts();

    // Publish in two channels
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'ch-a',
        items: [makeItem('p1', 'Ch-A Headline')],
      });
    });
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'ch-b',
        items: [makeItem('p2', 'Ch-B Headline')],
      });
    });

    // Replace ch-a with p3 → should not touch ch-b
    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'ch-a',
        items: [makeItem('p3', 'Ch-A New Headline')],
      });
    });

    const chB = await con.getRepository(PostHighlight).find({
      where: { channel: 'ch-b' },
    });
    expect(chB).toHaveLength(1);
    expect(chB[0]).toMatchObject({
      postId: 'p2',
      headline: 'Ch-B Headline',
      retiredAt: null,
    });
  });

  it('should handle empty items by only retiring existing', async () => {
    await createTestPosts();

    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Headline 1')],
      });
    });

    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [],
      });
    });

    const active = await con.getRepository(PostHighlight).find({
      where: { channel: 'test-ch', retiredAt: IsNull() },
    });
    expect(active).toHaveLength(0);

    const all = await con.getRepository(PostHighlight).find({
      where: { channel: 'test-ch' },
    });
    expect(all).toHaveLength(1);
    expect(all[0].retiredAt).not.toBeNull();
  });

  it('should update headline and significance on re-publish of active post', async () => {
    await createTestPosts();

    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Original', { significanceLabel: 'routine' })],
      });
    });

    const original = await con.getRepository(PostHighlight).findOneBy({
      channel: 'test-ch',
      postId: 'p1',
    });

    await con.transaction(async (manager) => {
      await replaceHighlightsForChannel({
        manager,
        channel: 'test-ch',
        items: [makeItem('p1', 'Updated', { significanceLabel: 'breaking' })],
      });
    });

    const updated = await con.getRepository(PostHighlight).findOneBy({
      channel: 'test-ch',
      postId: 'p1',
    });

    expect(updated!.id).toBe(original!.id);
    expect(updated!.headline).toBe('Updated');
    expect(updated!.significance).toBe(PostHighlightSignificance.Breaking);
  });
});
