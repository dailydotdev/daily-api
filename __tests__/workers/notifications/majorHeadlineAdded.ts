import { DataSource } from 'typeorm';
import { PostHighlightedMessage } from '@dailydotdev/schema';
import createOrGetConnection from '../../../src/db';
import { Post, Source, User } from '../../../src/entity';
import { PostHighlightSignificance } from '../../../src/entity/PostHighlight';
import { majorHeadlineAdded } from '../../../src/workers/notifications/majorHeadlineAdded';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';
import { sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers/notifications';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

const baseMessage = {
  highlightId: 'h1',
  channel: 'global',
  postId: 'p1',
  headline: 'Breaking news headline',
  significance: PostHighlightSignificance.Breaking,
  reason: undefined,
  highlightedAt: new Date(),
};

const invoke = (overrides: Partial<typeof baseMessage> = {}) =>
  invokeTypedNotificationWorker<'api.v1.post-highlighted'>(
    majorHeadlineAdded,
    new PostHighlightedMessage({ ...baseMessage, ...overrides }),
  );

describe('majorHeadlineAdded notification worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === majorHeadlineAdded.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should generate notification for Breaking significance', async () => {
    const result = await invoke({
      significance: PostHighlightSignificance.Breaking,
    });

    expect(result?.length).toEqual(1);
    expect(result?.[0]?.type).toEqual(NotificationType.MajorHeadlineAdded);
    expect(result?.[0]?.ctx).toMatchObject({
      headline: baseMessage.headline,
      channel: baseMessage.channel,
      significance: PostHighlightSignificance.Breaking,
    });
  });

  it('should generate notification for Major significance', async () => {
    const result = await invoke({
      significance: PostHighlightSignificance.Major,
    });

    expect(result?.length).toEqual(1);
    expect(result?.[0]?.ctx).toMatchObject({
      significance: PostHighlightSignificance.Major,
    });
  });

  it.each([
    PostHighlightSignificance.Notable,
    PostHighlightSignificance.Routine,
    PostHighlightSignificance.Unspecified,
  ])('should skip notification for %s significance', async (significance) => {
    const result = await invoke({ significance });

    expect(result).toBeUndefined();
  });

  it('should skip when post does not exist', async () => {
    const result = await invoke({ postId: 'does-not-exist' });

    expect(result).toBeUndefined();
  });

  it('should skip when post is private', async () => {
    await con.getRepository(Post).update('p1', { private: true });

    const result = await invoke();

    expect(result).toBeUndefined();
  });

  it('should skip when post is not visible', async () => {
    await con.getRepository(Post).update('p1', { visible: false });

    const result = await invoke();

    expect(result).toBeUndefined();
  });

  it('should skip when post is deleted', async () => {
    await con.getRepository(Post).update('p1', { deleted: true });

    const result = await invoke();

    expect(result).toBeUndefined();
  });

  it('should skip when post is flagged with vordr', async () => {
    await con.getRepository(Post).update('p1', { flags: { vordr: true } });

    const result = await invoke();

    expect(result).toBeUndefined();
  });

  it('should exclude users that muted in-app major_headline_added', async () => {
    await con.getRepository(User).update(
      { id: '1' },
      {
        notificationFlags: {
          [NotificationType.MajorHeadlineAdded]: {
            inApp: NotificationPreferenceStatus.Muted,
            email: NotificationPreferenceStatus.Subscribed,
          },
        },
      },
    );

    const result = await invoke();

    expect(result?.length).toEqual(1);
    const ctx = result?.[0]?.ctx as { userIds: string[] };
    expect(ctx.userIds).not.toContain('1');
  });

  it('should skip when no users are subscribed', async () => {
    await con
      .createQueryBuilder()
      .update(User)
      .set({
        notificationFlags: {
          [NotificationType.MajorHeadlineAdded]: {
            inApp: NotificationPreferenceStatus.Muted,
            email: NotificationPreferenceStatus.Muted,
          },
        },
      })
      .execute();

    const result = await invoke();

    expect(result).toBeUndefined();
  });
});
