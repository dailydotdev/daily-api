import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity/user/User';
import { PersonalAccessToken } from '../../../src/entity/PersonalAccessToken';
import { ArticlePost } from '../../../src/entity/posts/ArticlePost';
import { Source } from '../../../src/entity/Source';
import { Keyword } from '../../../src/entity/Keyword';
import { usersFixture, plusUsersFixture } from '../../fixture/user';
import { sourcesFixture } from '../../fixture/source';
import { postsFixture } from '../../fixture/post';
import { keywordsFixture } from '../../fixture/keywords';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { generatePersonalAccessToken } from '../../../src/common/personalAccessToken';
import { v4 as uuidv4 } from 'uuid';
import { ioRedisPool } from '../../../src/redis';

export type TestState = {
  app: FastifyInstance;
  con: DataSource;
};

export const setupPublicApiTests = (): TestState => {
  const state: TestState = {} as TestState;

  beforeAll(async () => {
    state.con = await createOrGetConnection();
    state.app = await appFunc();
    return state.app.ready();
  });

  afterAll(() => state.app.close());

  beforeEach(async () => {
    jest.resetAllMocks();
    await ioRedisPool.execute((client) => client.flushall());
    await saveFixtures(state.con, User, usersFixture);
    await saveFixtures(state.con, User, plusUsersFixture);
    await saveFixtures(state.con, Source, sourcesFixture);
    await saveFixtures(state.con, ArticlePost, postsFixture);
    await saveFixtures(state.con, Keyword, keywordsFixture);
  });

  return state;
};

export const createTokenForUser = async (
  con: DataSource,
  userId: string,
): Promise<string> => {
  const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
  await con.getRepository(PersonalAccessToken).save({
    id: uuidv4(),
    userId,
    name: 'Test Token',
    tokenHash,
    tokenPrefix,
  });
  return token;
};
