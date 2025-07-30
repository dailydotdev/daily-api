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
  AutocompleteType,
  DEFAULT_AUTOCOMPLETE_LIMIT,
} from '../src/schema/userExperience';
import { UserSkill } from '../src/entity/user/UserSkill';
import { Company, CompanyType } from '../src/entity/Company';
import { UserWorkExperience } from '../src/entity/user/experiences/UserWorkExperience';
import { ExperienceStatus } from '../src/entity/user/experiences/types';
import { User } from '../src/entity';
import { usersFixture } from './fixture';
import { UserAwardExperience } from '../src/entity/user/experiences/UserAwardExperience';

describe('autocomplete query', () => {
  let con: DataSource;
  let state: GraphQLTestingState;
  let client: GraphQLTestClient;
  let loggedUser: string | null = null;

  const QUERY = `
    query Autocomplete($type: String!, $query: String!, $limit: Int) {
      experienceAutocomplete(type: $type, query: $query, limit: $limit) {
        query
        limit
        hits {
          __typename
          ... on ExperienceHit {
            id
            title
            issuer
          }
          ... on CompanyHit {
            id
            name
          }
          ... on SkillHit {
            slug
            name
          }
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
    it('should return empty hits for query shorter than 2 characters', async () => {
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Skill,
          query: 'a',
        },
      });
      expect(res.data.experienceAutocomplete).toEqual({
        query: 'a',
        limit: DEFAULT_AUTOCOMPLETE_LIMIT,
        hits: [],
      });
    });

    it('should return empty hits for empty query', async () => {
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Skill,
          query: '',
        },
      });

      expect(res.data.experienceAutocomplete).toEqual({
        query: '',
        limit: DEFAULT_AUTOCOMPLETE_LIMIT,
        hits: [],
      });
    });

    it('should return empty hits for query longer than 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Skill,
          query: longQuery,
        },
      });

      expect(res.data.experienceAutocomplete).toEqual({
        query: longQuery,
        limit: DEFAULT_AUTOCOMPLETE_LIMIT,
        hits: [],
      });
    });

    it('should throw validation error for invalid autocomplete type', () => {
      return testQueryErrorCode(
        client,
        {
          query: QUERY,
          variables: {
            type: 'invalid_type',
            query: 'test',
          },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
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
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Skill,
          query: 'script',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('script');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(2);
      expect(res.data.experienceAutocomplete.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'JavaScript' }),
          expect.objectContaining({ name: 'TypeScript' }),
        ]),
      );
    });

    it('should respect the limit parameter', async () => {
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Skill,
          query: 'script',
          limit: 1,
        },
      });

      expect(res.data.experienceAutocomplete.limit).toEqual(1);
      expect(res.data.experienceAutocomplete.hits).toHaveLength(1);
    });
  });

  describe('experiences autocomplete', () => {
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
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.JobTitle,
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
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.AwardIssuer,
          query: 'proj',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('proj');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(1);
      expect(res.data.experienceAutocomplete.hits[0].issuer).toEqual(
        'Open Source Project',
      );
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
      ]);
    });

    it('should return matching business companies', async () => {
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.Company,
          query: 'apple',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('apple');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(1);
      expect(res.data.experienceAutocomplete.hits[0].name).toEqual('Apple');
    });

    it('should return matching schools', async () => {
      const res = await client.query(QUERY, {
        variables: {
          type: AutocompleteType.School,
          query: 'university',
        },
      });

      expect(res.data.experienceAutocomplete.query).toEqual('university');
      expect(res.data.experienceAutocomplete.hits).toHaveLength(2);
      expect(res.data.experienceAutocomplete.hits[0].name).toStrictEqual(
        'Apple university',
      );
      expect(res.data.experienceAutocomplete.hits[1].name).toStrictEqual(
        'Stanford University',
      );
    });
  });
});
