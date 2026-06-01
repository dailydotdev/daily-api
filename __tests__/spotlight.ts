import type { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  SpotlightAction,
  SpotlightActionGroup,
  SpotlightActionKind,
} from '../src/entity/SpotlightAction';
import {
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import type { GraphQLTestClient, GraphQLTestingState } from './helpers';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  await con.getRepository(SpotlightAction).clear();
});

describe('query spotlightActions', () => {
  const QUERY = /* GraphQL */ `
    {
      spotlightActions {
        id
        group
        title
        quickKey
        kind
        payload
      }
    }
  `;

  it('should return active spotlight actions ordered by group, priority, and id', async () => {
    await con.getRepository(SpotlightAction).save([
      {
        id: 'create-later',
        group: SpotlightActionGroup.Create,
        title: 'Create later',
        subtitle: null,
        icon: 'Plus',
        keywords: [],
        shortcut: null,
        quickKey: null,
        requiresAuth: false,
        requiresPlus: false,
        platforms: null,
        kind: SpotlightActionKind.OpenModal,
        payload: { modal: 'CreateSharedPost' },
        priority: 20,
        active: true,
      },
      {
        id: 'create-first',
        group: SpotlightActionGroup.Create,
        title: 'Create first',
        subtitle: null,
        icon: 'Plus',
        keywords: [],
        shortcut: null,
        quickKey: 'cf',
        requiresAuth: false,
        requiresPlus: false,
        platforms: null,
        kind: SpotlightActionKind.OpenModal,
        payload: { modal: 'NewSource' },
        priority: 10,
        active: true,
      },
      {
        id: 'hidden',
        group: SpotlightActionGroup.Create,
        title: 'Hidden',
        subtitle: null,
        icon: 'Plus',
        keywords: [],
        shortcut: null,
        quickKey: null,
        requiresAuth: false,
        requiresPlus: false,
        platforms: null,
        kind: SpotlightActionKind.OpenModal,
        payload: { modal: 'NewSquad' },
        priority: 1,
        active: false,
      },
      {
        id: 'nav-profile',
        group: SpotlightActionGroup.Navigate,
        title: 'Go to profile',
        subtitle: null,
        icon: 'User',
        keywords: [],
        shortcut: null,
        quickKey: 'me',
        requiresAuth: true,
        requiresPlus: false,
        platforms: null,
        kind: SpotlightActionKind.Navigate,
        payload: { path: '/${username}' },
        priority: 5,
        active: true,
      },
    ]);

    const res = await client.query(QUERY);

    expect(res.data.spotlightActions).toEqual([
      {
        id: 'create-first',
        group: 'Create',
        title: 'Create first',
        quickKey: 'cf',
        kind: 'OpenModal',
        payload: { modal: 'NewSource' },
      },
      {
        id: 'create-later',
        group: 'Create',
        title: 'Create later',
        quickKey: null,
        kind: 'OpenModal',
        payload: { modal: 'CreateSharedPost' },
      },
      {
        id: 'nav-profile',
        group: 'Navigate',
        title: 'Go to profile',
        quickKey: 'me',
        kind: 'Navigate',
        payload: { path: '/${username}' },
      },
    ]);
  });
});
