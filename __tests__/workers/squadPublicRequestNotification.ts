import {
  Comment,
  MachineSource,
  Post,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  User,
  UserAction,
  UserActionType,
} from '../../src/entity';
import { invokeTypedNotificationWorker } from '../helpers';
import {
  NotificationPostContext,
  NotificationSquadRequestContext,
} from '../../src/notifications';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { sourcesFixture, usersFixture } from '../fixture';
import { postsFixture } from '../fixture/post';
import { squadPublicRequestNotification } from '../../src/workers/notifications/squadPublicRequestNotification';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(MachineSource).save(sourcesFixture);
  await con.getRepository(Post).save([postsFixture[0], postsFixture[1]]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '2',
      content: 'comment',
      contentHtml: '<p>comment</p>',
    },
  ]);
  await con
    .getRepository(UserAction)
    .save({ userId: '1', type: UserActionType.SquadFirstPost });
});

describe('squad public request', () => {
  it('should add notification for approved squad public request', async () => {
    const request = await con.getRepository(SquadPublicRequest).save({
      sourceId: 'a',
      requestorId: '1',
      status: SquadPublicRequestStatus.Approved,
    });
    const actual =
      await invokeTypedNotificationWorker<'api.v1.squad-public-request'>(
        squadPublicRequestNotification,
        { request },
      );
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('squad_public_approved');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect(
      (bundle.ctx as NotificationSquadRequestContext).squadRequest.id,
    ).toEqual(request.id);
    expect(bundle.ctx.userIds).toIncludeSameMembers(['1']);
  });

  it('should add notification for rejected squad public request', async () => {
    const request = await con.getRepository(SquadPublicRequest).save({
      sourceId: 'a',
      requestorId: '1',
      status: SquadPublicRequestStatus.Rejected,
    });
    const actual =
      await invokeTypedNotificationWorker<'api.v1.squad-public-request'>(
        squadPublicRequestNotification,
        { request },
      );
    expect(actual.length).toEqual(1);
    const bundle = actual[0];
    expect(bundle.type).toEqual('squad_public_rejected');
    expect((bundle.ctx as NotificationPostContext).source.id).toEqual('a');
    expect(
      (bundle.ctx as NotificationSquadRequestContext).squadRequest.id,
    ).toEqual(request.id);
    expect(bundle.ctx.userIds).toIncludeSameMembers(['1']);
  });
});
