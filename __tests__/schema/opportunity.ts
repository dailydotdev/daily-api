import { DataSource } from 'typeorm';
import { User, Keyword } from '../../src/entity';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { Organization } from '../../src/entity/Organization';
import { OpportunityKeyword } from '../../src/entity/OpportunityKeyword';
import createOrGetConnection from '../../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from '../helpers';
import { keywordsFixture } from '../fixture/keywords';
import { usersFixture } from '../fixture';
import {
  opportunitiesFixture,
  opportunityKeywordsFixture,
  opportunityMatchesFixture,
  organizationsFixture,
} from '../fixture/opportunity';

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

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Keyword, keywordsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, Opportunity, opportunitiesFixture);
  await saveFixtures(con, OpportunityKeyword, opportunityKeywordsFixture);
  await saveFixtures(con, OpportunityMatch, opportunityMatchesFixture);
});

describe('opportunity queries', () => {
  describe('opportunityById', () => {
    const OPPORTUNITY_BY_ID_QUERY = `
      query OpportunityById($id: ID!) {
        opportunityById(id: $id) {
          id
          type
          title
          tldr
          content {
            title
            content
            html
          }
          organization {
            id
            name
            image
            website
            description
            location
          }
          users {
            id
          }
          keywords {
            value
          }
        }
      }
    `;

    it('should return opportunity by id', async () => {
      const res = await client.query(OPPORTUNITY_BY_ID_QUERY, {
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.opportunityById).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440001',
        type: 'JOB',
        title: 'Senior Full Stack Developer',
        tldr: 'Join our team as a Senior Full Stack Developer',
        content: [
          {
            title: 'Job Description',
            content: 'We are looking for a Senior Full Stack Developer...',
            html: '<p>We are looking for a Senior Full Stack Developer...</p>',
          },
        ],
        organization: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Daily Dev Inc',
          image: 'https://example.com/logo.png',
          website: 'https://daily.dev',
          description: 'A platform for developers',
          location: 'San Francisco',
        },
        users: [],
        keywords: expect.arrayContaining([
          { value: 'webdev' },
          { value: 'fullstack' },
        ]),
      });
    });

    it('should return UNEXPECTED for false UUID opportunity', async () => {
      await testQueryErrorCode(
        client,
        { query: OPPORTUNITY_BY_ID_QUERY, variables: { id: 'non-existing' } },
        'UNEXPECTED',
      );
    });

    it('should return null for not existing opportunity', async () => {
      await testQueryErrorCode(
        client,
        {
          query: OPPORTUNITY_BY_ID_QUERY,
          variables: { id: '660e8400-e29b-41d4-a716-446655440000' },
        },
        'NOT_FOUND',
      );
    });
  });

  describe('getOpportunityMatch', () => {
    const GET_OPPORTUNITY_MATCH_QUERY = `
      query GetOpportunityMatch($id: ID!) {
        getOpportunityMatch(id: $id) {
          status
          description {
            description
          }
        }
      }
    `;

    it('should return opportunity match for authenticated user', async () => {
      loggedUser = '1';

      const res = await client.query(GET_OPPORTUNITY_MATCH_QUERY, {
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.getOpportunityMatch).toEqual({
        status: 'PENDING',
        description: {
          description: 'Interested candidate',
        },
      });
    });

    it('should return different match for different user', async () => {
      loggedUser = '2';

      const res = await client.query(GET_OPPORTUNITY_MATCH_QUERY, {
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.getOpportunityMatch).toEqual({
        status: 'CANDIDATE_ACCEPTED',
        description: {
          description: 'Accepted candidate',
        },
      });
    });

    it('should require authentication', async () => {
      await testQueryErrorCode(
        client,
        {
          query: GET_OPPORTUNITY_MATCH_QUERY,
          variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
        },
        'UNAUTHENTICATED',
      );
    });

    it('should return null for non-existent match', async () => {
      loggedUser = '1';

      await testQueryErrorCode(
        client,
        {
          query: GET_OPPORTUNITY_MATCH_QUERY,
          variables: { id: '770e8400-e29b-41d4-a716-446655440001' },
        },
        'NOT_FOUND',
      );
    });

    it('should return null when user has no match for opportunity', async () => {
      loggedUser = '3';

      await testQueryErrorCode(
        client,
        {
          query: GET_OPPORTUNITY_MATCH_QUERY,
          variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
        },
        'NOT_FOUND',
      );
    });
  });
});
