import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { User, UserQuestProfile } from '../src/entity';
import { ghostUser, systemUser } from '../src/common';
import { getQuestLevelState } from '../src/common/quest';
import { MODERATORS } from '../src/config';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
});

afterAll(async () => disposeGraphQLTesting(state));

describe('query highestLevel', () => {
  const QUERY = `
    query HighestLevel($limit: Int) {
      highestLevel(limit: $limit) {
        score
        user {
          id
          username
        }
        level {
          level
          totalXp
          xpInLevel
          xpToNextLevel
        }
      }
    }
  `;

  it('should return users ordered by highest XP with computed level data', async () => {
    await saveFixtures(con, User, [
      { id: 'u1', username: 'user1' },
      { id: 'u2', username: 'user2' },
      { id: 'u3', username: 'user3' },
    ]);

    await saveFixtures(con, UserQuestProfile, [
      { userId: 'u1', totalXp: 300 },
      { userId: 'u2', totalXp: 600 },
      { userId: 'u3', totalXp: 50 },
    ]);

    const res = await client.query(QUERY, { variables: { limit: 3 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.highestLevel).toMatchObject([
      {
        score: 600,
        user: { id: 'u2', username: 'user2' },
        level: getQuestLevelState(600),
      },
      {
        score: 300,
        user: { id: 'u1', username: 'user1' },
        level: getQuestLevelState(300),
      },
      {
        score: 50,
        user: { id: 'u3', username: 'user3' },
        level: getQuestLevelState(50),
      },
    ]);
  });

  it('should exclude ghost, system, and moderator users from highest level ranking', async () => {
    const fixtures: Array<Partial<User>> = [
      { id: 'u-regular', username: 'regular' },
      { id: ghostUser.id, username: 'ghost' },
      { id: systemUser.id, username: 'system' },
    ];

    const moderatorId = MODERATORS[0];
    if (moderatorId) {
      fixtures.push({ id: moderatorId, username: 'moderator' });
    }

    await saveFixtures(con, User, fixtures);

    const profileFixtures: Array<Partial<UserQuestProfile>> = [
      { userId: 'u-regular', totalXp: 100 },
      { userId: ghostUser.id, totalXp: 10000 },
      { userId: systemUser.id, totalXp: 9000 },
    ];

    if (moderatorId) {
      profileFixtures.push({ userId: moderatorId, totalXp: 8000 });
    }

    await saveFixtures(con, UserQuestProfile, profileFixtures);

    const res = await client.query(QUERY, { variables: { limit: 10 } });

    expect(res.errors).toBeFalsy();
    const ids = res.data.highestLevel.map(
      (entry: { user: { id: string } }) => entry.user.id,
    );

    expect(ids).toContain('u-regular');
    expect(ids).not.toContain(ghostUser.id);
    expect(ids).not.toContain(systemUser.id);

    if (moderatorId) {
      expect(ids).not.toContain(moderatorId);
    }
  });
});
