import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import {
  DEFAULT_AUTOCOMPLETE_LIMIT,
  ExperienceAutocompleteType,
} from '../src/schema/userExperience';
import { UserSkill } from '../src/entity/user/UserSkill';
import { Company, CompanyType } from '../src/entity/Company';
import { UserWorkExperience } from '../src/entity/user/experiences/UserWorkExperience';
import { ExperienceStatus } from '../src/entity/user/experiences/types';
import { User } from '../src/entity';
import { usersFixture } from './fixture';
import { UserAwardExperience } from '../src/entity/user/experiences/UserAwardExperience';

describe('autocomplete queries', () => {
  let con: DataSource;
  let state: GraphQLTestingState;
  let client: GraphQLTestClient;
  let loggedUser: string | null = null;

  const EXPERIENCE_QUERY = `
    query ExperienceAutocomplete($type: String!, $query: String!, $limit: Int) {
      experienceAutocomplete(type: $type, query: $query, limit: $limit) {
        query
        limit
        hits {
          id
          title
        }
      }
    }
  `;

  const COMPANY_QUERY = `
    query CompanyAutocomplete($query: String!, $limit: Int, $type: String) {
      companyAutocomplete(query: $query, limit: $limit, type: $type) {
        query
        limit
        hits {
          id
          name
          image
        }
      }
    }
  `;

  const SKILL_QUERY = `
    query SkillAutocomplete($query: String!, $limit: Int) {
      skillAutocomplete(query: $query, limit: $limit) {
        query
        limit
        hits {
          slug
          name
        }
      }
    }
  `;

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

  afterAll(async () => {
    await disposeGraphQLTesting(state);
  });

  describe('input validation', () => {
    describe('experience', () => {
      it('should throw error if user is not logged in', () => {
        return testQueryErrorCode(
          client,
          {
            query: EXPERIENCE_QUERY,
            variables: {
              type: ExperienceAutocompleteType.JobTitle,
              query: 'test',
            },
          },
          'UNAUTHENTICATED',
        );
      });

      it('should return empty hits for query shorter than 2 characters', async () => {
        loggedUser = '1';
        const res = await client.query(EXPERIENCE_QUERY, {
          variables: {
            type: ExperienceAutocompleteType.JobTitle,
            query: 'a',
          },
        });
        expect(res.data.experienceAutocomplete).toEqual({
          query: 'a',
          limit: DEFAULT_AUTOCOMPLETE_LIMIT,
          hits: [],
        });
      });

      it('should throw validation error for invalid experience type', () => {
        loggedUser = '1';
        return testQueryErrorCode(
          client,
          {
            query: EXPERIENCE_QUERY,
            variables: {
              type: 'invalid_type',
              query: 'test',
            },
          },
          'GRAPHQL_VALIDATION_FAILED',
        );
      });
    });

    describe('company', () => {
      it('should throw error if user is not logged in', () => {
        return testQueryErrorCode(
          client,
          {
            query: COMPANY_QUERY,
            variables: {
              query: 'test',
            },
          },
          'UNAUTHENTICATED',
        );
      });

      it('should return empty hits for query shorter than 2 characters', async () => {
        loggedUser = '1';
        const res = await client.query(COMPANY_QUERY, {
          variables: {
            query: 'a',
          },
        });
        expect(res.data.companyAutocomplete).toEqual({
          query: 'a',
          limit: DEFAULT_AUTOCOMPLETE_LIMIT,
          hits: [],
        });
      });
    });

    describe('skill', () => {
      it('should throw error if user is not logged in', () => {
        return testQueryErrorCode(
          client,
          {
            query: SKILL_QUERY,
            variables: {
              query: 'test',
            },
          },
          'UNAUTHENTICATED',
        );
      });

      it('should return empty hits for query shorter than 2 characters', async () => {
        loggedUser = '1';
        const res = await client.query(SKILL_QUERY, {
          variables: {
            query: 'a',
          },
        });
        expect(res.data.skillAutocomplete).toEqual({
          query: 'a',
          limit: DEFAULT_AUTOCOMPLETE_LIMIT,
          hits: [],
        });
      });

      it('should return empty hits for empty query', async () => {
        loggedUser = '1';
        const res = await client.query(SKILL_QUERY, {
          variables: {
            query: '',
          },
        });

        expect(res.data.skillAutocomplete).toEqual({
          query: '',
          limit: DEFAULT_AUTOCOMPLETE_LIMIT,
          hits: [],
        });
      });

      it('should return empty hits for query longer than 100 characters', async () => {
        loggedUser = '1';
        const longQuery = 'a'.repeat(101);
        const res = await client.query(SKILL_QUERY, {
          variables: {
            query: longQuery,
          },
        });

        expect(res.data.skillAutocomplete).toEqual({
          query: longQuery,
          limit: DEFAULT_AUTOCOMPLETE_LIMIT,
          hits: [],
        });
      });
    });
  });

  describe('skills autocomplete', () => {
    beforeEach(async () => {
      // Create test data for skills
      await saveFixtures(con, UserSkill, [
        { name: 'JavaScript', slug: 'javascript' },
        { name: 'TypeScript', slug: 'typescript' },
        { name: 'React', slug: 'react' },
        { name: 'Node.js', slug: 'nodejs' },
        { name: 'GraphQL', slug: 'graphql' },
      ]);
    });

    it('should return matching skills', async () => {
      loggedUser = '1';
      const res = await client.query(SKILL_QUERY, {
        variables: {
          query: 'script',
        },
      });

      expect(res.data.skillAutocomplete.query).toEqual('script');
      expect(res.data.skillAutocomplete.hits).toHaveLength(2);
      expect(res.data.skillAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'JavaScript', slug: 'javascript' }),
          expect.objectContaining({ name: 'TypeScript', slug: 'typescript' }),
        ]),
      );
    });

    it('should respect the limit parameter', async () => {
      loggedUser = '1';
      const res = await client.query(SKILL_QUERY, {
        variables: {
          query: 'script',
          limit: 1,
        },
      });

      expect(res.data.skillAutocomplete.limit).toEqual(1);
      expect(res.data.skillAutocomplete.hits).toHaveLength(1);
    });
  });

  describe('experiences autocomplete', () => {
    loggedUser = '1';
    beforeEach(async () => {
      await saveFixtures(con, User, usersFixture);
      await saveFixtures(con, UserWorkExperience, [
        {
          userId: '1',
          title: 'Software Engineer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date(),
        },
        {
          userId: '1',
          title: 'Senior Software Engineer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date(),
        },
        {
          userId: '1',
          title: 'Software Developer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date(),
        },
        {
          userId: '1',
          title: 'Frontend Developer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date(),
        },
        {
          userId: '1',
          title: 'Draft Job Title',
          status: ExperienceStatus.Draft,
          description: '',
          startDate: new Date(),
        },
      ]);
      await saveFixtures(con, UserAwardExperience, [
        {
          userId: '1',
          title: 'Best Developer Award',
          issuer: 'Tech Company',
          status: ExperienceStatus.Published,
          startDate: new Date('2024-12-12'),
        },
        {
          userId: '1',
          title: 'Outstanding Contribution Award',
          issuer: 'Open Source Project',
          status: ExperienceStatus.Published,
          startDate: new Date('2024-12-12'),
        },
        {
          userId: '1',
          title: 'Draft Award Title',
          issuer: 'Draft Issuer Project',
          status: ExperienceStatus.Draft,
          startDate: new Date('2024-12-12'),
        },
      ]);
    });

    it('should return matching job titles with published status', async () => {
      loggedUser = '1';
      const res = await client.query(EXPERIENCE_QUERY, {
        variables: {
          type: ExperienceAutocompleteType.JobTitle,
          query: 'software',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('software');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(3);
      expect(res.data.experienceAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Software Engineer' }),
          expect.objectContaining({ title: 'Senior Software Engineer' }),
          expect.objectContaining({ title: 'Software Developer' }),
        ]),
      );

      // Should not include draft job titles
      expect(res.data.experienceAutocomplete.hits).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Draft Software Job Title' }),
        ]),
      );
    });

    it('should return matching issuers for published experiences', async () => {
      loggedUser = '1';
      const res = await client.query(EXPERIENCE_QUERY, {
        variables: {
          type: ExperienceAutocompleteType.AwardIssuer,
          query: 'proj',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('proj');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(1);
      expect(res.data.experienceAutocomplete.hits[0].title).toEqual(
        'Open Source Project',
      );
    });

    it('should return matching titles for award experiences', async () => {
      loggedUser = '1';
      const res = await client.query(EXPERIENCE_QUERY, {
        variables: {
          type: ExperienceAutocompleteType.AwardName,
          query: 'award',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('award');
      expect(res.data.experienceAutocomplete.limit).toEqual(10);
      expect(res.data.experienceAutocomplete.hits).toHaveLength(2);
      expect(res.data.experienceAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Best Developer Award' }),
          expect.objectContaining({ title: 'Outstanding Contribution Award' }),
        ]),
      );
    });

    it('should respect the limit parameter', async () => {
      loggedUser = '1';
      const res = await client.query(EXPERIENCE_QUERY, {
        variables: {
          type: ExperienceAutocompleteType.JobTitle,
          query: 'software',
          limit: 2,
        },
      });

      expect(res.data.experienceAutocomplete.limit).toEqual(2);
      expect(res.data.experienceAutocomplete.hits).toHaveLength(2);
    });
  });

  describe('company autocomplete', () => {
    beforeEach(async () => {
      // Create test data for companies
      await saveFixtures(con, Company, [
        {
          id: 'company1',
          name: 'Google',
          type: CompanyType.Business,
          image: 'https://example.com/google.png',
        },
        {
          id: 'company2',
          name: 'Microsoft',
          type: CompanyType.Business,
          image: 'https://example.com/microsoft.png',
        },
        {
          id: 'company3',
          name: 'Apple',
          type: CompanyType.Business,
          image: 'https://example.com/apple.png',
        },
        {
          id: 'company4',
          name: 'Apple university',
          type: CompanyType.School,
          image: 'https://example.com/apple.png',
        },
        {
          id: 'company5',
          name: 'Stanford University',
          type: CompanyType.School,
          image: 'https://example.com/stanford.png',
        },
        {
          id: 'company6',
          name: 'MIT',
          type: CompanyType.School,
          image: 'https://example.com/mit.png',
        },
        {
          id: 'company7',
          name: 'Apple dupe',
          type: CompanyType.Business,
          image: 'https://example.com/apple.png',
        },
      ]);
    });

    it('should return matching business companies', async () => {
      loggedUser = '1';
      const res = await client.query(COMPANY_QUERY, {
        variables: {
          query: 'apple',
        },
      });

      expect(res.data.companyAutocomplete.query).toEqual('apple');
      expect(res.data.companyAutocomplete.hits).toHaveLength(2);
      expect(res.data.companyAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Apple' }),
          expect.objectContaining({ name: 'Apple dupe' }),
        ]),
      );
    });

    it('should not return business while searching for schools', async () => {
      loggedUser = '1';
      const res = await client.query(COMPANY_QUERY, {
        variables: {
          query: 'univ',
          type: CompanyType.School,
        },
      });

      expect(res.data.companyAutocomplete.hits).toHaveLength(2);
      expect(res.data.companyAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Apple university' }),
          expect.objectContaining({ name: 'Stanford University' }),
        ]),
      );
    });

    it('should respect the limit parameter', async () => {
      loggedUser = '1';
      const res = await client.query(COMPANY_QUERY, {
        variables: {
          query: 'apple',
          limit: 1,
        },
      });

      expect(res.data.companyAutocomplete.limit).toEqual(1);
      expect(res.data.companyAutocomplete.hits).toHaveLength(1);
      expect(res.data.companyAutocomplete.hits[0].name).toEqual('Apple');
    });
  });
});
