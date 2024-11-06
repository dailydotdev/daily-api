import { DataSource } from 'typeorm';
import worker from '../../../src/workers/notifications/sourcePostModerationSubmitted';
import createOrGetConnection from '../../../src/db';
import { Source, SourceMember, SourceType, User } from '../../../src/entity';
import { sourcesFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { SquadPostModerationStatus } from '../../../src/entity/sourcePostModeration';
import { SourceMemberRoles } from '../../../src/roles';
import { NotificationPostModerationContext } from '../../../src/notifications';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('squadPostModerationSubmitted', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification when the status is not pending', async () => {
    const post = {
      sourceId: 'a',
      status: SquadPostModerationStatus.Approved,
    };

    const result = await invokeNotificationWorker(worker, { post });

    expect(result).toBeUndefined();
  });

  it('should send notification to admins', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SquadPostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Admin,
      referralToken: 'a',
    });

    const result = await invokeNotificationWorker(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should send notification to moderators', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SquadPostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Moderator,
      referralToken: 'a',
    });

    const result = await invokeNotificationWorker(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should not send notification to members', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SquadPostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Member,
        referralToken: 'b',
      },
    ]);

    const result = await invokeNotificationWorker(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noMembers = ctx.userIds.every((id) => id !== '3');
    expect(noMembers).toBeTruthy();
  });

  it('should not send notification to blocked members', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SquadPostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Blocked,
        referralToken: 'b',
      },
    ]);

    const result = await invokeNotificationWorker(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noMembers = ctx.userIds.every((id) => id !== '3');
    expect(noMembers).toBeTruthy();
  });

  it('should not send notification to post author', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SquadPostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Blocked,
        referralToken: 'b',
      },
    ]);

    const result = await invokeNotificationWorker(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noAuthor = ctx.userIds.every((id) => id !== '2');
    expect(noAuthor).toBeTruthy();
  });
});
