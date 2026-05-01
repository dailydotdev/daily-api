import jwt from 'jsonwebtoken';
import nock from 'nock';
import type { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Feature, FeatureType, FeatureValue } from '../src/entity/Feature';
import { LiveRoom } from '../src/entity/LiveRoom';
import { StorageKey, StorageTopic } from '../src/config';
import {
  disposeGraphQLTesting,
  type GraphQLTestClient,
  type GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
} from './helpers';
import { usersFixture } from './fixture/user';
import { User } from '../src/entity/user/User';
import { LiveRoomStatus } from '../src/common/schema/liveRooms';
import { deleteKeysByPattern } from '../src/redis';

const flytingOrigin = 'http://flyting.test';
const flytingInternalKey = 'flyting-internal-key';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let loggedTrackingId: string | undefined = undefined;

beforeAll(async () => {
  process.env.FLYTING_JOIN_TOKEN_SECRET = 'flyting-join-secret';
  process.env.FLYTING_INTERNAL_KEY = flytingInternalKey;
  process.env.FLYTING_ORIGIN = flytingOrigin;

  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        [],
        undefined,
        false,
        false,
        '',
        loggedTrackingId,
      ),
  );
  client = state.client;
});

afterAll(async () => {
  nock.cleanAll();
  await disposeGraphQLTesting(state);
});

beforeEach(async () => {
  loggedUser = null;
  loggedTrackingId = undefined;
  nock.cleanAll();
  await deleteKeysByPattern(
    `${StorageTopic.LiveRoom}:${StorageKey.ParticipantCount}:*`,
  );
  await saveFixtures(con, User, usersFixture);
});

describe('live rooms', () => {
  const grantStandupAccess = async (userId: string): Promise<void> => {
    await con.getRepository(Feature).save({
      feature: FeatureType.Standup,
      userId,
      value: FeatureValue.Allow,
    });
  };

  const CREATE_MUTATION = /* GraphQL */ `
    mutation CreateLiveRoom($input: CreateLiveRoomInput!) {
      createLiveRoom(input: $input) {
        role
        token
        room {
          id
          topic
          mode
          status
          participantCount
          host {
            id
            username
          }
        }
      }
    }
  `;

  const GET_QUERY = /* GraphQL */ `
    query LiveRoom($id: ID!) {
      liveRoom(id: $id) {
        id
        topic
        mode
        status
        participantCount
        host {
          id
          username
        }
      }
    }
  `;

  const ACTIVE_QUERY = /* GraphQL */ `
    query ActiveLiveRooms {
      activeLiveRooms {
        id
        topic
        mode
        status
        participantCount
        host {
          id
          username
        }
      }
    }
  `;

  const JOIN_TOKEN_MUTATION = /* GraphQL */ `
    mutation LiveRoomJoinToken($roomId: ID!) {
      liveRoomJoinToken(roomId: $roomId) {
        role
        token
        room {
          id
          topic
          mode
          status
          participantCount
          host {
            id
            username
          }
        }
      }
    }
  `;

  const END_MUTATION = /* GraphQL */ `
    mutation EndLiveRoom($roomId: ID!) {
      endLiveRoom(roomId: $roomId) {
        id
        status
        endedAt
        participantCount
      }
    }
  `;

  it('requires authentication to create a live room', () =>
    testMutationErrorCode(
      client,
      {
        mutation: CREATE_MUTATION,
        variables: {
          input: {
            topic: 'A room topic',
            mode: 'moderated',
          },
        },
      },
      'UNAUTHENTICATED',
    ));

  it('requires standup feature access to create a live room', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: CREATE_MUTATION,
        variables: {
          input: {
            topic: 'A room topic',
            mode: 'moderated',
          },
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );

    expect(
      await con.getRepository(LiveRoom).findOneBy({ topic: 'A room topic' }),
    ).toBeNull();
  });

  it('creates a live room and prepares it in flyting', async () => {
    loggedUser = '1';
    await grantStandupAccess(loggedUser);

    let preparePath = '';
    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'moderated',
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(function reply(uri) {
        preparePath = uri;
        return [200, { room: { roomId: 'ignored' } }];
      });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'GraphQL and SFUs',
          mode: 'moderated',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createLiveRoom).toMatchObject({
      role: 'host',
      token: expect.any(String),
      room: {
        topic: 'GraphQL and SFUs',
        mode: 'moderated',
        status: 'created',
        participantCount: null,
        host: {
          id: '1',
          username: 'idoshamun',
        },
      },
    });

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: res.data.createLiveRoom.room.id,
    });

    expect(room).toMatchObject({
      hostId: '1',
      topic: 'GraphQL and SFUs',
      status: LiveRoomStatus.Created,
    });
    expect(scope.isDone()).toBe(true);
    expect(preparePath.split('/')[3]).toBe(room.id);

    const verified = jwt.verify(
      res.data.createLiveRoom.token,
      'flyting-join-secret',
      {
        algorithms: ['HS256'],
        audience: 'flyting',
        issuer: 'daily-api',
      },
    );

    expect(verified).toMatchObject({
      iat: expect.any(Number),
      participantId: '1',
      role: 'host',
      roomId: room.id,
    });
  });

  it('creates a free-for-all live room and forwards its mode to flyting', async () => {
    loggedUser = '1';
    await grantStandupAccess(loggedUser);

    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'free_for_all',
        speakerLimit: 6,
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, { room: { roomId: 'ignored' } });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Open mic architecture',
          mode: 'free_for_all',
          speakerLimit: 6,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createLiveRoom.room).toMatchObject({
      topic: 'Open mic architecture',
      mode: 'free_for_all',
      status: 'created',
      participantCount: null,
    });

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: res.data.createLiveRoom.room.id,
    });

    expect(room.mode).toBe('free_for_all');
    expect(scope.isDone()).toBe(true);
  });

  it('rejects speaker limits for moderated live rooms', async () => {
    loggedUser = '1';
    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/)
      .reply(200, { room: { roomId: 'ignored' } });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Strictly moderated',
          mode: 'moderated',
          speakerLimit: 3,
        },
      },
    });

    expect(res.errors?.[0]?.message).toBe('Validation error');
    expect(scope.isDone()).toBe(false);
    await expect(
      con.getRepository(LiveRoom).findOneBy({ topic: 'Strictly moderated' }),
    ).resolves.toBeNull();
  });

  it('keeps the durable room when prepare fails ambiguously', async () => {
    loggedUser = '1';
    await grantStandupAccess(loggedUser);

    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'moderated',
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .times(6)
      .reply(500, { message: 'boom' });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Ambiguous prepare',
          mode: 'moderated',
        },
      },
    });

    expect(res.errors?.[0]?.message).toBe('Unexpected error');

    const rooms = await con.getRepository(LiveRoom).findBy({
      hostId: '1',
      topic: 'Ambiguous prepare',
    });

    expect(scope.isDone()).toBe(true);
    expect(rooms).toHaveLength(1);
  }, 10000);

  it('removes the durable room when prepare fails definitively', async () => {
    loggedUser = '1';
    await grantStandupAccess(loggedUser);

    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'moderated',
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(400, { message: 'invalid' });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Invalid prepare',
          mode: 'moderated',
        },
      },
    });

    expect(res.errors?.[0]?.message).toBe('Unexpected error');

    const rooms = await con.getRepository(LiveRoom).findBy({
      hostId: '1',
      topic: 'Invalid prepare',
    });

    expect(scope.isDone()).toBe(true);
    expect(rooms).toHaveLength(0);
  });

  it('returns only live rooms', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '0d0bd25e-e1f9-4b7d-8ddb-82f11e882201',
        hostId: '1',
        topic: 'Created room',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
        createdAt: new Date('2026-04-23T10:00:00.000Z'),
      },
      {
        id: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
        hostId: '2',
        topic: 'Live room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
        createdAt: new Date('2026-04-23T11:00:00.000Z'),
      },
      {
        id: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Ended room',
        mode: 'moderated',
        status: LiveRoomStatus.Ended,
        endedAt: new Date('2026-04-23T12:00:00.000Z'),
        createdAt: new Date('2026-04-23T12:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['cc4f63c0-b26e-44fb-b9f8-4c977b28a123'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        rooms: [
          {
            roomId: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
            participantCount: 7,
          },
        ],
      });

    const res = await client.query(ACTIVE_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      activeLiveRooms: [
        {
          id: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
          topic: 'Live room',
          mode: 'moderated',
          status: 'live',
          participantCount: 7,
          host: {
            id: '2',
            username: 'tsahidaily',
          },
        },
      ],
    });
    expect(scope.isDone()).toBe(true);
  });

  it('batches participant counts for active live rooms through the field resolver', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '11111111-b26e-44fb-b9f8-4c977b28a123',
        hostId: '1',
        topic: 'Live room one',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
        createdAt: new Date('2026-04-23T11:00:00.000Z'),
      },
      {
        id: '22222222-b26e-44fb-b9f8-4c977b28a123',
        hostId: '2',
        topic: 'Live room two',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T12:00:00.000Z'),
        createdAt: new Date('2026-04-23T12:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: [
          '22222222-b26e-44fb-b9f8-4c977b28a123',
          '11111111-b26e-44fb-b9f8-4c977b28a123',
        ],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        rooms: [
          {
            roomId: '22222222-b26e-44fb-b9f8-4c977b28a123',
            participantCount: 11,
          },
          {
            roomId: '11111111-b26e-44fb-b9f8-4c977b28a123',
            participantCount: 7,
          },
        ],
      });

    const res = await client.query(ACTIVE_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.activeLiveRooms).toEqual([
      {
        id: '22222222-b26e-44fb-b9f8-4c977b28a123',
        topic: 'Live room two',
        mode: 'moderated',
        status: 'live',
        participantCount: 11,
        host: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        id: '11111111-b26e-44fb-b9f8-4c977b28a123',
        topic: 'Live room one',
        mode: 'moderated',
        status: 'live',
        participantCount: 7,
        host: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
    expect(scope.isDone()).toBe(true);
  });

  it('keeps active live rooms visible when the batched count lookup fails', async () => {
    await saveFixtures(con, LiveRoom, [
      {
        id: '7c4f63c0-b26e-44fb-b9f8-4c977b28a123',
        hostId: '2',
        topic: 'Live room without count',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
        createdAt: new Date('2026-04-23T11:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['7c4f63c0-b26e-44fb-b9f8-4c977b28a123'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .times(6)
      .reply(500, { message: 'boom' });

    const res = await client.query(ACTIVE_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      activeLiveRooms: [
        {
          id: '7c4f63c0-b26e-44fb-b9f8-4c977b28a123',
          topic: 'Live room without count',
          mode: 'moderated',
          status: 'live',
          participantCount: null,
          host: {
            id: '2',
            username: 'tsahidaily',
          },
        },
      ],
    });
    expect(scope.isDone()).toBe(true);
  }, 10000);

  it('returns a join token for the host role', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Token room',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
      },
    ]);

    const scope = nock(flytingOrigin)
      .get(
        '/internal/live-rooms/f44bb4ae-a0af-4310-b1ff-7d6345cb5253/participants/1/join-eligibility',
      )
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        roomId: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        participantId: '1',
        canJoin: true,
      });

    const res = await client.mutate(JOIN_TOKEN_MUTATION, {
      variables: {
        roomId: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.liveRoomJoinToken).toMatchObject({
      role: 'host',
      room: {
        id: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        topic: 'Token room',
        status: 'created',
        participantCount: null,
        host: {
          id: '1',
          username: 'idoshamun',
        },
      },
    });

    const verified = jwt.verify(
      res.data.liveRoomJoinToken.token,
      'flyting-join-secret',
      {
        algorithms: ['HS256'],
        audience: 'flyting',
        issuer: 'daily-api',
      },
    );

    expect(verified).toMatchObject({
      authKind: 'authenticated',
      iat: expect.any(Number),
      participantId: '1',
      role: 'host',
      roomId: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
    });
    expect(scope.isDone()).toBe(true);
  });

  it('returns an anonymous join token for a live room using trackingId identity', async () => {
    loggedTrackingId = 'tracking-anon-1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Live room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .get(
        '/internal/live-rooms/aa4bb4ae-a0af-4310-b1ff-7d6345cb5253/participants/tracking-anon-1/join-eligibility',
      )
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        roomId: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
        participantId: 'tracking-anon-1',
        canJoin: true,
      });
    const countsScope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['aa4bb4ae-a0af-4310-b1ff-7d6345cb5253'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        rooms: [
          {
            roomId: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
            participantCount: 9,
          },
        ],
      });

    const res = await client.mutate(JOIN_TOKEN_MUTATION, {
      variables: {
        roomId: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.liveRoomJoinToken).toMatchObject({
      role: 'audience',
      room: {
        id: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
        topic: 'Live room',
        status: 'live',
        participantCount: 9,
      },
    });

    const verified = jwt.verify(
      res.data.liveRoomJoinToken.token,
      'flyting-join-secret',
      {
        algorithms: ['HS256'],
        audience: 'flyting',
        issuer: 'daily-api',
      },
    );

    expect(verified).toMatchObject({
      authKind: 'anonymous',
      iat: expect.any(Number),
      participantId: 'tracking-anon-1',
      role: 'audience',
      roomId: 'aa4bb4ae-a0af-4310-b1ff-7d6345cb5253',
    });
    expect(scope.isDone()).toBe(true);
    expect(countsScope.isDone()).toBe(true);
  });

  it('rejects join tokens for ended rooms', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'e1de5dd8-03f7-4ec4-9094-f4f1bd24ef51',
        hostId: '1',
        topic: 'Ended room',
        mode: 'moderated',
        status: LiveRoomStatus.Ended,
        endedAt: new Date(),
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: JOIN_TOKEN_MUTATION,
        variables: {
          roomId: 'e1de5dd8-03f7-4ec4-9094-f4f1bd24ef51',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Cannot join an ended live room',
    );
  });

  it('rejects anonymous join tokens for rooms that are not live yet', async () => {
    loggedTrackingId = 'tracking-anon-1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'b14bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Created room',
        mode: 'moderated',
        status: LiveRoomStatus.Created,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: JOIN_TOKEN_MUTATION,
        variables: {
          roomId: 'b14bb4ae-a0af-4310-b1ff-7d6345cb5253',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Anonymous viewers can only join live rooms',
    );
  });

  it('rejects join tokens when flyting reports that the participant was kicked from the room', async () => {
    loggedTrackingId = 'tracking-kicked-1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'c14bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Blocked room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .get(
        '/internal/live-rooms/c14bb4ae-a0af-4310-b1ff-7d6345cb5253/participants/tracking-kicked-1/join-eligibility',
      )
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        roomId: 'c14bb4ae-a0af-4310-b1ff-7d6345cb5253',
        participantId: 'tracking-kicked-1',
        canJoin: false,
        reason: 'kicked',
      });

    await testMutationErrorCode(
      client,
      {
        mutation: JOIN_TOKEN_MUTATION,
        variables: {
          roomId: 'c14bb4ae-a0af-4310-b1ff-7d6345cb5253',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'You have been removed from this live room',
    );

    expect(scope.isDone()).toBe(true);
  });

  it('ends a live room for the host', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'a8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
        hostId: '1',
        topic: 'Endable room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T15:00:00.000Z'),
      },
    ]);

    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/a8c0e8ab-7517-4f08-b44c-5c24d3df2f18/end')
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        room: {
          roomId: 'a8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
          status: 'ended',
        },
      });

    const res = await client.mutate(END_MUTATION, {
      variables: {
        roomId: 'a8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.endLiveRoom.status).toBe('ended');
    expect(res.data.endLiveRoom.endedAt).toBeTruthy();
    expect(res.data.endLiveRoom.participantCount).toBeNull();
    expect(scope.isDone()).toBe(true);
  });

  it('ends a live room for a co-host with live authority', async () => {
    loggedUser = '2';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'b8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
        hostId: '1',
        topic: 'Co-host endable room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T15:00:00.000Z'),
      },
    ]);

    const privilegesScope = nock(flytingOrigin)
      .get(
        '/internal/live-rooms/b8c0e8ab-7517-4f08-b44c-5c24d3df2f18/participants/2/privileges',
      )
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        roomId: 'b8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
        participantId: '2',
        isHost: false,
        isCoHost: true,
        hasHostPrivileges: true,
        canGrantCoHost: false,
      });
    const endScope = nock(flytingOrigin)
      .post('/internal/live-rooms/b8c0e8ab-7517-4f08-b44c-5c24d3df2f18/end')
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        room: {
          roomId: 'b8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
          status: 'ended',
        },
      });

    const res = await client.mutate(END_MUTATION, {
      variables: {
        roomId: 'b8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.endLiveRoom.status).toBe('ended');
    expect(privilegesScope.isDone()).toBe(true);
    expect(endScope.isDone()).toBe(true);
  });

  it('rejects ending a room by a non-host', async () => {
    loggedUser = '2';

    await saveFixtures(con, LiveRoom, [
      {
        id: '13f8f8a6-bf26-4e5b-bb46-aef17389db7b',
        hostId: '1',
        topic: 'Protected room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
      },
    ]);

    const privilegesScope = nock(flytingOrigin)
      .get(
        '/internal/live-rooms/13f8f8a6-bf26-4e5b-bb46-aef17389db7b/participants/2/privileges',
      )
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        roomId: '13f8f8a6-bf26-4e5b-bb46-aef17389db7b',
        participantId: '2',
        isHost: false,
        isCoHost: false,
        hasHostPrivileges: false,
        canGrantCoHost: false,
      });

    await testMutationErrorCode(
      client,
      {
        mutation: END_MUTATION,
        variables: {
          roomId: '13f8f8a6-bf26-4e5b-bb46-aef17389db7b',
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );
    expect(privilegesScope.isDone()).toBe(true);
  });

  it('returns a room by id', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        hostId: '2',
        topic: 'Readable room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
      },
    ]);
    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['42e45613-c9f8-4823-96cb-ebd6dcbbf4fe'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        rooms: [
          {
            roomId: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
            participantCount: 5,
          },
        ],
      });

    const res = await client.query(GET_QUERY, {
      variables: {
        id: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      liveRoom: {
        id: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        topic: 'Readable room',
        mode: 'moderated',
        status: 'live',
        participantCount: 5,
        host: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    });
    expect(scope.isDone()).toBe(true);
  });

  it('caches live room participant counts across queries', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '62e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        hostId: '2',
        topic: 'Cached room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
      },
    ]);

    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['62e45613-c9f8-4823-96cb-ebd6dcbbf4fe'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .once()
      .reply(200, {
        rooms: [
          {
            roomId: '62e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
            participantCount: 13,
          },
        ],
      });

    const first = await client.query(GET_QUERY, {
      variables: {
        id: '62e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
      },
    });
    const second = await client.query(GET_QUERY, {
      variables: {
        id: '62e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
      },
    });

    expect(first.errors).toBeFalsy();
    expect(second.errors).toBeFalsy();
    expect(first.data.liveRoom.participantCount).toBe(13);
    expect(second.data.liveRoom.participantCount).toBe(13);
    expect(scope.isDone()).toBe(true);
  });

  it('returns a live room by id for an anonymous caller', async () => {
    loggedTrackingId = 'tracking-anon-1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '52e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        hostId: '2',
        topic: 'Public live room',
        mode: 'moderated',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
      },
    ]);
    const scope = nock(flytingOrigin)
      .post('/internal/live-rooms/counts', {
        roomIds: ['52e45613-c9f8-4823-96cb-ebd6dcbbf4fe'],
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(200, {
        rooms: [
          {
            roomId: '52e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
            participantCount: 4,
          },
        ],
      });

    const res = await client.query(GET_QUERY, {
      variables: {
        id: '52e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      liveRoom: {
        id: '52e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        topic: 'Public live room',
        mode: 'moderated',
        status: 'live',
        participantCount: 4,
        host: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    });
    expect(scope.isDone()).toBe(true);
  });
});
