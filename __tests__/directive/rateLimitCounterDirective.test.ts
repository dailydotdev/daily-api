import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { ioRedisPool } from '../../src/redis';
import {
  typeDefs as rateLimitCounterTypeDefs,
  transformer as rateLimitCounterTransformer,
} from '../../src/directive/rateLimitCounter';

const baseTypeDefs = `
  type Mutation {
    doAction: String @rateLimitCounter(maxTries: 5, period: "P7D", key: "test-key")
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

describe('rateLimitCounter directive', () => {
  const userId = 'test-directive-user';
  const plusUserId = 'test-directive-plus-user';
  const schema = rateLimitCounterTransformer(
    makeExecutableSchema({
      typeDefs: [baseTypeDefs, rateLimitCounterTypeDefs],
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
    expect(result.errors?.[0].message).toMatch(/limit/);
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
