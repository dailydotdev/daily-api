import jwt from 'jsonwebtoken';
import nock from 'nock';
import type { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { LiveRoom } from '../src/entity/LiveRoom';
import {
  disposeGraphQLTesting,
  type GraphQLTestClient,
  type GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { usersFixture } from './fixture/user';
import { User } from '../src/entity/user/User';
import { LiveRoomStatus } from '../src/common/schema/liveRooms';

const flytingOrigin = 'http://flyting.test';
const flytingInternalKey = 'flyting-internal-key';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  process.env.FLYTING_JOIN_TOKEN_SECRET = 'flyting-join-secret';
  process.env.FLYTING_INTERNAL_KEY = flytingInternalKey;
  process.env.FLYTING_ORIGIN = flytingOrigin;

  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(async () => {
  nock.cleanAll();
  await disposeGraphQLTesting(state);
});

beforeEach(async () => {
  loggedUser = null;
  nock.cleanAll();
  await saveFixtures(con, User, usersFixture);
});

describe('live rooms', () => {
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
        status
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
          status
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
            mode: 'debate',
          },
        },
      },
      'UNAUTHENTICATED',
    ));

  it('creates a live room and prepares it in flyting', async () => {
    loggedUser = '1';

    let preparePath = '';
    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'debate',
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
          mode: 'debate',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createLiveRoom).toMatchObject({
      role: 'host',
      token: expect.any(String),
      room: {
        topic: 'GraphQL and SFUs',
        mode: 'debate',
        status: 'created',
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

  it('keeps the durable room when prepare fails ambiguously', async () => {
    loggedUser = '1';

    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'debate',
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .times(6)
      .reply(500, { message: 'boom' });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Ambiguous prepare',
          mode: 'debate',
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

    const scope = nock(flytingOrigin)
      .post(/\/internal\/live-rooms\/[^/]+\/prepare/, {
        mode: 'debate',
      })
      .matchHeader('x-flyting-internal-key', flytingInternalKey)
      .reply(400, { message: 'invalid' });

    const res = await client.mutate(CREATE_MUTATION, {
      variables: {
        input: {
          topic: 'Invalid prepare',
          mode: 'debate',
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

  it('returns all active live rooms', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '0d0bd25e-e1f9-4b7d-8ddb-82f11e882201',
        hostId: '1',
        topic: 'Created room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
        createdAt: new Date('2026-04-23T10:00:00.000Z'),
      },
      {
        id: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
        hostId: '2',
        topic: 'Live room',
        mode: 'debate',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T11:00:00.000Z'),
        createdAt: new Date('2026-04-23T11:00:00.000Z'),
      },
      {
        id: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Ended room',
        mode: 'debate',
        status: LiveRoomStatus.Ended,
        endedAt: new Date('2026-04-23T12:00:00.000Z'),
        createdAt: new Date('2026-04-23T12:00:00.000Z'),
      },
    ]);

    const res = await client.query(ACTIVE_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      activeLiveRooms: [
        {
          id: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
          topic: 'Live room',
          status: 'live',
          host: {
            id: '2',
            username: 'tsahidaily',
          },
        },
        {
          id: '0d0bd25e-e1f9-4b7d-8ddb-82f11e882201',
          topic: 'Created room',
          status: 'created',
          host: {
            id: '1',
            username: 'idoshamun',
          },
        },
      ],
    });
  });

  it('returns a join token for the host role', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
        hostId: '1',
        topic: 'Token room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
    ]);

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
      iat: expect.any(Number),
      participantId: '1',
      role: 'host',
      roomId: 'f44bb4ae-a0af-4310-b1ff-7d6345cb5253',
    });
  });

  it('rejects join tokens for ended rooms', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'e1de5dd8-03f7-4ec4-9094-f4f1bd24ef51',
        hostId: '1',
        topic: 'Ended room',
        mode: 'debate',
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

  it('ends a live room for the host', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: 'a8c0e8ab-7517-4f08-b44c-5c24d3df2f18',
        hostId: '1',
        topic: 'Endable room',
        mode: 'debate',
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
    expect(scope.isDone()).toBe(true);
  });

  it('rejects ending a room by a non-host', async () => {
    loggedUser = '2';

    await saveFixtures(con, LiveRoom, [
      {
        id: '13f8f8a6-bf26-4e5b-bb46-aef17389db7b',
        hostId: '1',
        topic: 'Protected room',
        mode: 'debate',
        status: LiveRoomStatus.Live,
      },
    ]);

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
  });

  it('returns a room by id', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        hostId: '2',
        topic: 'Readable room',
        mode: 'debate',
        status: LiveRoomStatus.Live,
      },
    ]);

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
        mode: 'debate',
        status: 'live',
        host: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    });
  });

  it('requires authentication to query a room', () =>
    testQueryErrorCode(
      client,
      {
        query: GET_QUERY,
        variables: {
          id: '42e45613-c9f8-4823-96cb-ebd6dcbbf4fe',
        },
      },
      'UNAUTHENTICATED',
    ));
});
