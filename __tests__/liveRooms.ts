import jwt from 'jsonwebtoken';
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
import { flytingClient } from '../src/integrations/flyting/client';
import { LiveRoomStatus } from '../src/common/schema/liveRooms';
import { AbortError, HttpError } from '../src/integrations/retry';

jest.mock('../src/integrations/flyting/client', () => ({
  flytingClient: {
    prepareRoom: jest.fn(),
    endRoom: jest.fn(),
  },
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  process.env.FLYTING_JOIN_TOKEN_SECRET = 'flyting-join-secret';
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('live rooms', () => {
  const CREATE_MUTATION = /* GraphQL */ `
    mutation CreateLiveRoom($input: CreateLiveRoomInput!) {
      createLiveRoom(input: $input) {
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

  const GET_QUERY = /* GraphQL */ `
    query LiveRoom($id: ID!) {
      liveRoom(id: $id) {
        id
        topic
        mode
        status
      }
    }
  `;

  const MY_QUERY = /* GraphQL */ `
    query MyLiveRooms {
      myLiveRooms {
        id
        topic
        status
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
    (flytingClient.prepareRoom as jest.Mock).mockResolvedValue(undefined);

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
      topic: 'GraphQL and SFUs',
      mode: 'debate',
      status: 'created',
      host: {
        id: '1',
        username: 'idoshamun',
      },
    });

    const room = await con.getRepository(LiveRoom).findOneByOrFail({
      id: res.data.createLiveRoom.id,
    });

    expect(room).toMatchObject({
      hostId: '1',
      topic: 'GraphQL and SFUs',
      status: LiveRoomStatus.Created,
    });
    expect(flytingClient.prepareRoom).toHaveBeenCalledWith({
      mode: 'debate',
      roomId: room.id,
      topic: 'GraphQL and SFUs',
    });
  });

  it('keeps the durable room when prepare fails ambiguously', async () => {
    loggedUser = '1';
    (flytingClient.prepareRoom as jest.Mock).mockRejectedValue(
      new Error('timeout'),
    );

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

    expect(rooms).toHaveLength(1);
  });

  it('removes the durable room when prepare fails definitively', async () => {
    loggedUser = '1';
    (flytingClient.prepareRoom as jest.Mock).mockRejectedValue(
      new AbortError(
        new HttpError(
          'https://flyting/internal/live-rooms/room/prepare',
          400,
          '',
        ),
      ),
    );

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

    expect(rooms).toHaveLength(0);
  });

  it('returns the current user live rooms', async () => {
    loggedUser = '1';

    await saveFixtures(con, LiveRoom, [
      {
        id: '0d0bd25e-e1f9-4b7d-8ddb-82f11e882201',
        hostId: '1',
        topic: 'First room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
      {
        id: 'cc4f63c0-b26e-44fb-b9f8-4c977b28a123',
        hostId: '2',
        topic: 'Other room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
    ]);

    const res = await client.query(MY_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      myLiveRooms: [
        {
          id: '0d0bd25e-e1f9-4b7d-8ddb-82f11e882201',
          topic: 'First room',
          status: 'created',
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
    expect(res.data.liveRoomJoinToken.role).toBe('host');

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
    (flytingClient.endRoom as jest.Mock).mockResolvedValue({ found: true });

    await saveFixtures(con, LiveRoom, [
      {
        id: '868f0787-e557-4db8-9d3f-5f18f1ab053d',
        hostId: '1',
        topic: 'End room',
        mode: 'debate',
        status: LiveRoomStatus.Live,
        startedAt: new Date('2026-04-23T12:00:00.000Z'),
      },
    ]);

    const res = await client.mutate(END_MUTATION, {
      variables: {
        roomId: '868f0787-e557-4db8-9d3f-5f18f1ab053d',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.endLiveRoom.status).toBe('ended');
    expect(res.data.endLiveRoom.endedAt).toBeTruthy();
    expect(flytingClient.endRoom).toHaveBeenCalledWith({
      roomId: '868f0787-e557-4db8-9d3f-5f18f1ab053d',
    });
  });

  it('rejects ending a room by a non-host', async () => {
    loggedUser = '2';
    await saveFixtures(con, LiveRoom, [
      {
        id: '5c516ee7-c0b8-4bff-ad99-d6c9dd8a01ea',
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
          roomId: '5c516ee7-c0b8-4bff-ad99-d6c9dd8a01ea',
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );
  });

  it('returns a room by id', async () => {
    loggedUser = '2';
    await saveFixtures(con, LiveRoom, [
      {
        id: '84cc36d1-d6ab-4950-9cc1-3cdf0f5d69d1',
        hostId: '1',
        topic: 'Visible room',
        mode: 'debate',
        status: LiveRoomStatus.Created,
      },
    ]);

    const res = await client.query(GET_QUERY, {
      variables: {
        id: '84cc36d1-d6ab-4950-9cc1-3cdf0f5d69d1',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.liveRoom).toEqual({
      id: '84cc36d1-d6ab-4950-9cc1-3cdf0f5d69d1',
      topic: 'Visible room',
      mode: 'debate',
      status: 'created',
    });
  });

  it('requires authentication to query a room', () =>
    testQueryErrorCode(
      client,
      {
        query: GET_QUERY,
        variables: {
          id: '84cc36d1-d6ab-4950-9cc1-3cdf0f5d69d1',
        },
      },
      'UNAUTHENTICATED',
    ));
});
