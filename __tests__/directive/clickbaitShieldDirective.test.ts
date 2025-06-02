import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { deleteRedisKey, ioRedisPool } from '../../src/redis';
import {
  typeDefs as clickbaitShieldTypeDefs,
  transformer as clickbaitShieldTransformer,
} from '../../src/directive/clickbaitShield';

const keyPrefix = 'clickbait-shield';
const getCurrentKey = (userId: string) => `${keyPrefix}:${userId}`;

const baseTypeDefs = `
  type Mutation {
    doAction: String @clickbaitShield
  }
  type Query {
    _empty: String
  }
`;

const resolvers = {
  Mutation: {
    doAction: () => 'done',
  },
};

describe('clickbaitShield directive', () => {
  const userId = 'test-directive-user';
  const plusUserId = 'test-directive-plus-user';
  const schema = clickbaitShieldTransformer(
    makeExecutableSchema({
      typeDefs: [baseTypeDefs, clickbaitShieldTypeDefs],
      resolvers,
    }),
  );

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should allow up to 5 actions for non-Plus user, then block', async () => {
    const mutation = `mutation { doAction }`;
    for (let i = 0; i < 5; i++) {
      const result = await graphql({
        schema,
        source: mutation,
        contextValue: { userId, isPlus: false },
      });
      expect(result.errors).toBeUndefined();
      expect(result.data?.doAction).toBe('done');
    }
    // 6th call should be blocked
    const result = await graphql({
      schema,
      source: mutation,
      contextValue: { userId, isPlus: false },
    });
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toMatch(/monthly limit/);
  });

  it('should never block Plus user', async () => {
    const mutation = `mutation { doAction }`;
    for (let i = 0; i < 10; i++) {
      const result = await graphql({
        schema,
        source: mutation,
        contextValue: { userId: plusUserId, isPlus: true },
      });
      expect(result.errors).toBeUndefined();
      expect(result.data?.doAction).toBe('done');
    }
  });
});
