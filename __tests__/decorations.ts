import {
  createMockNjordTransport,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationError,
  testMutationErrorCode,
} from './helpers';
import { Decoration, User, UserDecoration } from '../src/entity';
import { usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { CoresRole } from '../src/types';
import * as njordCommon from '../src/common/njord';
import { createClient } from '@connectrpc/connect';
import { Credits, EntityType } from '@dailydotdev/schema';
import { ioRedisPool } from '../src/redis';
import {
  UserTransaction,
  UserTransactionType,
} from '../src/entity/user/UserTransaction';
import { systemUser } from '../src/common';
import crypto from 'crypto';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

const decorationsFixture: Partial<Decoration>[] = [
  {
    id: 'purchasable-deco',
    name: 'Purchasable Decoration',
    media: 'https://example.com/deco1.png',
    decorationGroup: 'shop',
    unlockCriteria: null,
    groupOrder: 0,
    active: true,
    price: 100,
  },
  {
    id: 'subscriber-deco',
    name: 'Subscriber Decoration',
    media: 'https://example.com/deco2.png',
    decorationGroup: 'subscriber',
    unlockCriteria: 'Be a subscriber',
    groupOrder: 0,
    active: true,
    price: null,
  },
  {
    id: 'inactive-deco',
    name: 'Inactive Decoration',
    media: 'https://example.com/deco3.png',
    decorationGroup: 'shop',
    unlockCriteria: null,
    groupOrder: 1,
    active: false,
    price: 50,
  },
  {
    id: 'expensive-deco',
    name: 'Expensive Decoration',
    media: 'https://example.com/deco4.png',
    decorationGroup: 'shop',
    unlockCriteria: null,
    groupOrder: 2,
    active: true,
    price: 1000,
  },
];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  jest.resetAllMocks();

  await saveFixtures(
    con,
    User,
    usersFixture.map((item) => ({
      ...item,
      id: `${item.id}-deco`,
      username: `${item.username}-deco`,
      coresRole: CoresRole.User,
    })),
  );
  await saveFixtures(con, Decoration, decorationsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query decorationsByGroup', () => {
  const QUERY = `
    query DecorationsbyGroup {
      decorationsByGroup {
        group
        label
        decorations {
          id
          name
          media
          decorationGroup
          unlockCriteria
          price
          isUnlocked
          isPurchasable
        }
      }
    }
  `;

  it('should not allow unauthenticated users', () =>
    testMutationErrorCode(client, { mutation: QUERY }, 'UNAUTHENTICATED'));

  it('should return decorations with price and isPurchasable fields', async () => {
    loggedUser = '1-deco';

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();

    const { decorationsByGroup } = res.data;
    expect(decorationsByGroup).toBeDefined();

    const shopGroup = decorationsByGroup.find(
      (g: { group: string }) => g.group === 'shop',
    );
    expect(shopGroup).toBeDefined();
    expect(shopGroup.decorations).toHaveLength(2);

    const purchasable = shopGroup.decorations.find(
      (d: { id: string }) => d.id === 'purchasable-deco',
    );
    expect(purchasable).toMatchObject({
      id: 'purchasable-deco',
      name: 'Purchasable Decoration',
      price: 100,
      isUnlocked: false,
      isPurchasable: true,
    });
  });

  it('should mark owned decorations as unlocked and not purchasable', async () => {
    loggedUser = '1-deco';

    await con.getRepository(UserDecoration).insert({
      userId: loggedUser,
      decorationId: 'purchasable-deco',
    });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();

    const { decorationsByGroup } = res.data;
    const shopGroup = decorationsByGroup.find(
      (g: { group: string }) => g.group === 'shop',
    );
    const purchasable = shopGroup.decorations.find(
      (d: { id: string }) => d.id === 'purchasable-deco',
    );

    expect(purchasable).toMatchObject({
      isUnlocked: true,
      isPurchasable: false,
    });
  });
});

describe('mutation purchaseDecoration', () => {
  const MUTATION = `
    mutation PurchaseDecoration($decorationId: ID!) {
      purchaseDecoration(decorationId: $decorationId) {
        decoration {
          id
          name
          price
          isUnlocked
          isPurchasable
        }
        balance
      }
    }
  `;

  beforeEach(async () => {
    const mockTransport = createMockNjordTransport();

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should not allow unauthenticated users', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'purchasable-deco' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw error if user does not have cores access', async () => {
    loggedUser = '1-deco';

    await con
      .getRepository(User)
      .update({ id: loggedUser }, { coresRole: CoresRole.None });

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'purchasable-deco' },
      },
      (errors) => {
        expect(errors[0].message).toEqual('You do not have access to Cores');
      },
    );
  });

  it('should throw error if decoration does not exist', async () => {
    loggedUser = '1-deco';

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'non-existent' },
      },
      (errors) => {
        expect(errors[0].message).toEqual('Decoration not found');
      },
    );
  });

  it('should throw error if decoration is not active', async () => {
    loggedUser = '1-deco';

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'inactive-deco' },
      },
      (errors) => {
        expect(errors[0].message).toEqual('Decoration not found');
      },
    );
  });

  it('should throw error if decoration is not purchasable', async () => {
    loggedUser = '1-deco';

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'subscriber-deco' },
      },
      (errors) => {
        expect(errors[0].message).toEqual(
          'This decoration is not available for purchase',
        );
      },
    );
  });

  it('should throw error if user already owns the decoration', async () => {
    loggedUser = '1-deco';

    await con.getRepository(UserDecoration).insert({
      userId: loggedUser,
      decorationId: 'purchasable-deco',
    });

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'purchasable-deco' },
      },
      (errors) => {
        expect(errors[0].message).toEqual('You already own this decoration');
      },
    );
  });

  it('should throw error if user does not have enough cores', async () => {
    loggedUser = '1-deco';

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 50,
        },
      ],
    });

    await testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { decorationId: 'purchasable-deco' },
      },
      (errors) => {
        expect(errors[0].message).toEqual(
          'Not enough Cores to purchase this decoration',
        );
      },
    );
  });

  it('should successfully purchase decoration when user has enough cores', async () => {
    loggedUser = '1-deco';

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: crypto.randomUUID(),
      transfers: [
        {
          sender: { id: systemUser.id, type: EntityType.SYSTEM },
          receiver: { id: loggedUser, type: EntityType.USER },
          amount: 500,
        },
      ],
    });

    const res = await client.mutate(MUTATION, {
      variables: { decorationId: 'purchasable-deco' },
    });

    expect(res.errors).toBeFalsy();
    const { purchaseDecoration } = res.data;

    expect(purchaseDecoration).toMatchObject({
      decoration: {
        id: 'purchasable-deco',
        name: 'Purchasable Decoration',
        price: 100,
        isUnlocked: true,
        isPurchasable: false,
      },
      balance: 400,
    });

    const userDecoration = await con.getRepository(UserDecoration).findOneBy({
      userId: loggedUser,
      decorationId: 'purchasable-deco',
    });
    expect(userDecoration).toBeDefined();

    const transaction = await con.getRepository(UserTransaction).findOneBy({
      senderId: loggedUser,
      referenceType: UserTransactionType.DecorationPurchase,
      referenceId: 'purchasable-deco',
    });
    expect(transaction).toBeDefined();
    expect(transaction?.value).toEqual(100);
    expect(transaction?.receiverId).toEqual(systemUser.id);
  });
});
