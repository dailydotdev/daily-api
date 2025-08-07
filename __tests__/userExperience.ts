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
  getEmptyExperienceTypesMap,
} from '../src/common/userExperience';
import { UserSkill } from '../src/entity/user/UserSkill';
import { Company, CompanyType } from '../src/entity/Company';
import { UserWorkExperience } from '../src/entity/user/experiences/UserWorkExperience';
import {
  ExperienceStatus,
  ProjectLinkType,
  UserExperienceType,
} from '../src/entity/user/experiences/types';
import { User } from '../src/entity';
import { usersFixture } from './fixture';
import { UserAwardExperience } from '../src/entity/user/experiences/UserAwardExperience';
import { UserEducationExperience } from '../src/entity/user/experiences/UserEducationExperience';
import { UserProjectExperience } from '../src/entity/user/experiences/UserProjectExperience';
import { UserCertificationExperience } from '../src/entity/user/experiences/UserCertificationExperience';
import { UserPublicationExperience } from '../src/entity/user/experiences/UserPublicationExperience';
import { UserCourseExperience } from '../src/entity/user/experiences/UserCourseExperience';
import { v4 as uuidv4 } from 'uuid';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

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

describe('autocomplete queries', () => {
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
          startDate: new Date('2024-01-01'),
        },
        {
          userId: '1',
          title: 'Senior Software Engineer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date('2024-02-01'),
        },
        {
          userId: '1',
          title: 'Software Developer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date('2024-03-01'),
        },
        {
          userId: '1',
          title: 'Frontend Developer',
          status: ExperienceStatus.Published,
          description: '',
          startDate: new Date('2024-04-01'),
        },
        {
          userId: '1',
          title: 'Draft Job Title',
          status: ExperienceStatus.Draft,
          description: '',
          startDate: new Date('2024-05-01'),
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

describe('user experience', () => {
  const currentJobId = uuidv4();
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    // Create test companies for education and certification
    await saveFixtures(con, Company, [
      {
        id: 'school1',
        name: 'Stanford University',
        type: CompanyType.School,
        image: 'https://example.com/stanford.png',
      },
      {
        id: 'company1',
        name: 'Certification Provider',
        type: CompanyType.Business,
        image: 'https://example.com/cert-provider.png',
      },
    ]);

    await saveFixtures(con, UserWorkExperience, [
      {
        id: currentJobId,
        userId: '1',
        title: 'Software Engineer',
        status: ExperienceStatus.Published,
        description: '',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2021-01-31'),
      },
      {
        userId: '1',
        title: 'Senior Software Engineer',
        status: ExperienceStatus.Published,
        description: '',
        startDate: new Date('2021-02-01'),
        endDate: new Date('2024-01-28'),
      },
      {
        // ongoing experience
        userId: '1',
        title: 'Software Developer',
        status: ExperienceStatus.Published,
        description: '',
        startDate: new Date('2024-01-29'),
      },
      {
        // ongoing experience
        userId: '1',
        title: 'Frontend Developer',
        status: ExperienceStatus.Published,
        description: '',
        startDate: new Date('2022-01-01'),
      },
      {
        // drafted experience
        userId: '1',
        title: 'Draft Job Title',
        status: ExperienceStatus.Draft,
        description: '',
        startDate: new Date('2024-05-01'),
      },
    ]);

    await saveFixtures(con, UserEducationExperience, [
      {
        userId: '1',
        title: 'Computer Science Degree',
        schoolId: 'school1',
        fieldOfStudy: 'Computer Science',
        grade: 'A',
        extracurriculars: 'Programming Club',
        status: ExperienceStatus.Published,
        description: 'Bachelor of Science in Computer Science',
        startDate: new Date('2016-09-01'),
        endDate: new Date('2020-06-30'),
      },
      {
        userId: '1',
        title: 'Draft Education',
        schoolId: 'school1',
        fieldOfStudy: 'Data Science',
        status: ExperienceStatus.Draft,
        description: '',
        startDate: new Date('2022-09-01'),
      },
    ]);

    await saveFixtures(con, UserProjectExperience, [
      {
        userId: '1',
        title: 'Personal Portfolio Website',
        status: ExperienceStatus.Published,
        description: 'Created a personal portfolio website to showcase my work',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-02-28'),
        links: [
          {
            type: ProjectLinkType.Code,
            url: 'https://github.com/user/portfolio',
          },
          {
            type: ProjectLinkType.LivePreview,
            url: 'https://portfolio.example.com',
          },
        ],
        contributors: ['2'],
        workingExperienceId: null,
        educationExperienceId: null,
      },
      {
        userId: '1',
        title: 'Draft Project',
        status: ExperienceStatus.Draft,
        description: 'A project in draft status',
        startDate: new Date('2024-01-01'),
        links: [],
        contributors: [],
        workingExperienceId: null,
        educationExperienceId: null,
      },
    ]);

    await saveFixtures(con, UserCertificationExperience, [
      {
        userId: '1',
        title: 'AWS Certified Developer',
        companyId: 'company1',
        courseNumber: 'AWS-DEV-123',
        credentialId: 'CERT-12345',
        credentialUrl: 'https://cert.example.com/verify/12345',
        status: ExperienceStatus.Published,
        description: 'Certification for AWS development',
        startDate: new Date('2022-05-15'),
      },
      {
        userId: '1',
        title: 'Draft Certification',
        companyId: 'company1',
        status: ExperienceStatus.Draft,
        description: '',
        startDate: new Date('2024-03-01'),
      },
    ]);

    await saveFixtures(con, UserPublicationExperience, [
      {
        userId: '1',
        title: 'Introduction to GraphQL',
        publisher: 'Tech Journal',
        url: 'https://journal.example.com/graphql-intro',
        contributors: ['2'],
        status: ExperienceStatus.Published,
        description: 'An article about GraphQL basics',
        startDate: new Date('2023-06-15'),
        workingExperienceId: null,
        educationExperienceId: null,
      },
      {
        userId: '1',
        title: 'Draft Publication',
        publisher: 'Draft Publisher',
        status: ExperienceStatus.Draft,
        description: '',
        startDate: new Date('2024-04-01'),
        workingExperienceId: null,
        educationExperienceId: null,
      },
    ]);

    await saveFixtures(con, UserCourseExperience, [
      {
        userId: '1',
        title: 'Advanced JavaScript',
        courseNumber: 'JS-301',
        institution: 'Online Learning Platform',
        status: ExperienceStatus.Published,
        description: 'Course covering advanced JavaScript concepts',
        startDate: new Date('2022-10-01'),
        endDate: new Date('2022-12-15'),
      },
      {
        userId: '1',
        title: 'Draft Course',
        institution: 'Draft Institution',
        status: ExperienceStatus.Draft,
        description: '',
        startDate: new Date('2024-06-01'),
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

  describe('query all', () => {
    const QUERY = `
      query UserExperiences($status: [ExperienceStatus!]) {
        userExperiences(status: $status) {
          work {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            skills {
              slug
              name
            }
          }
          education {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            schoolId
            fieldOfStudy
            grade
            extracurriculars
            skills {
              slug
              name
            }
          }
          project {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            links {
              type
              url
            }
            contributors
            skills {
              slug
              name
            }
          }
          certification {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            companyId
            courseNumber
            credentialId
            credentialUrl
            skills {
              slug
              name
            }
          }
          publication {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            publisher
            url
            contributors
            skills {
              slug
              name
            }
          }
          course {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            courseNumber
            institution
            skills {
              slug
              name
            }
          }
          award {
            id
            userId
            title
            description
            startDate
            endDate
            type
            status
            issuer
            skills {
              slug
              name
            }
          }
        }
      }
  `;

    it('should throw error if user is not logged in', () => {
      return testQueryErrorCode(
        client,
        {
          query: QUERY,
          variables: {},
        },
        'UNAUTHENTICATED',
      );
    });

    it('should return user experiences', async () => {
      loggedUser = '1';
      const res = await client.query<
        {
          userExperiences: ReturnType<typeof getEmptyExperienceTypesMap>;
        },
        { status?: ExperienceStatus[] }
      >(QUERY, {
        variables: {},
      });

      // Test work experiences
      expect(res.data.userExperiences.work).toHaveLength(4);
      expect(res.data.userExperiences.work).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Software Engineer' }),
          expect.objectContaining({ title: 'Senior Software Engineer' }),
          expect.objectContaining({ title: 'Software Developer' }),
          expect.objectContaining({ title: 'Frontend Developer' }),
        ]),
      );

      // Test education experiences
      expect(res.data.userExperiences.education).toHaveLength(1);
      expect(res.data.userExperiences.education).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Computer Science Degree',
            fieldOfStudy: 'Computer Science',
            grade: 'A',
            extracurriculars: 'Programming Club',
          }),
        ]),
      );

      // Test project experiences
      expect(res.data.userExperiences.project).toHaveLength(1);
      expect(res.data.userExperiences.project[0]).toEqual(
        expect.objectContaining({
          title: 'Personal Portfolio Website',
          links: expect.arrayContaining([
            expect.objectContaining({
              type: ProjectLinkType.Code,
              url: 'https://github.com/user/portfolio',
            }),
          ]),
        }),
      );

      // Test certification experiences
      expect(res.data.userExperiences.certification).toHaveLength(1);
      expect(res.data.userExperiences.certification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'AWS Certified Developer',
            courseNumber: 'AWS-DEV-123',
            credentialId: 'CERT-12345',
          }),
        ]),
      );

      // Test publication experiences
      expect(res.data.userExperiences.publication).toHaveLength(1);
      expect(res.data.userExperiences.publication).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Introduction to GraphQL',
            publisher: 'Tech Journal',
            url: 'https://journal.example.com/graphql-intro',
          }),
        ]),
      );

      // Test course experiences
      expect(res.data.userExperiences.course).toHaveLength(1);
      expect(res.data.userExperiences.course).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Advanced JavaScript',
            courseNumber: 'JS-301',
            institution: 'Online Learning Platform',
          }),
        ]),
      );

      // Test award experiences
      expect(res.data.userExperiences.award).toHaveLength(2);
      expect(res.data.userExperiences.award).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Best Developer Award' }),
          expect.objectContaining({ title: 'Outstanding Contribution Award' }),
        ]),
      );
    });

    it('should return both published and draft experiences', async () => {
      loggedUser = '1';
      const res = await client.query<
        {
          userExperiences: ReturnType<typeof getEmptyExperienceTypesMap>;
        },
        { status?: ExperienceStatus[] }
      >(QUERY, {
        variables: {
          status: [ExperienceStatus.Published, ExperienceStatus.Draft],
        },
      });

      // Test work experiences including draft
      expect(res.data.userExperiences.work).toHaveLength(5);
      expect(res.data.userExperiences.work).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Draft Job Title' }),
        ]),
      );

      // Test education experiences including draft
      expect(res.data.userExperiences.education).toHaveLength(2);
      expect(res.data.userExperiences.education).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Draft Education',
            fieldOfStudy: 'Data Science',
          }),
        ]),
      );

      // Test project experiences including draft
      expect(res.data.userExperiences.project).toHaveLength(2);
      expect(res.data.userExperiences.project).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Draft Project',
            description: 'A project in draft status',
          }),
        ]),
      );

      // Test certification experiences including draft
      expect(res.data.userExperiences.certification).toHaveLength(2);
      expect(res.data.userExperiences.certification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Draft Certification',
          }),
        ]),
      );

      // Test publication experiences including draft
      expect(res.data.userExperiences.publication).toHaveLength(2);
      expect(res.data.userExperiences.publication).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Draft Publication',
            publisher: 'Draft Publisher',
          }),
        ]),
      );

      // Test course experiences including draft
      expect(res.data.userExperiences.course).toHaveLength(2);
      expect(res.data.userExperiences.course).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Draft Course',
            institution: 'Draft Institution',
          }),
        ]),
      );

      // Test award experiences including draft
      expect(res.data.userExperiences.award).toHaveLength(3);
      expect(res.data.userExperiences.award).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Draft Award Title' }),
        ]),
      );
    });

    it('should return empty arrays if no experiences found', async () => {
      loggedUser = '2'; // User with no experiences
      const res = await client.query<
        {
          userExperiences: ReturnType<typeof getEmptyExperienceTypesMap>;
        },
        { status?: ExperienceStatus[] }
      >(QUERY, {
        variables: {},
      });

      expect(res.data.userExperiences.work).toHaveLength(0);
      expect(res.data.userExperiences.award).toHaveLength(0);
    });

    it('should return sorted experiences, first ongoing, then sorted by end date', async () => {
      loggedUser = '1';
      const res = await client.query<
        {
          userExperiences: ReturnType<typeof getEmptyExperienceTypesMap>;
        },
        { status?: ExperienceStatus[] }
      >(QUERY, {
        variables: {},
      });

      expect(res.data.userExperiences.work).toHaveLength(4);
      // check that ongoing experience is first
      // - ongoing, started later
      expect(res.data.userExperiences.work[0].title).toEqual(
        'Software Developer',
      );
      // - ongoing, started earlier
      expect(res.data.userExperiences.work[1].title).toEqual(
        'Frontend Developer',
      );
      // check that experiences are sorted by the end date
      expect(res.data.userExperiences.work[2].title).toEqual(
        'Senior Software Engineer',
      );
      expect(res.data.userExperiences.work[3].title).toEqual(
        'Software Engineer',
      );
    });
  });

  describe('remove experience', () => {
    const MUTATION = `
      mutation RemoveExperience($id: ID!) {
        removeExperience(id: $id){
          _
        }
      }
    `;

    it('should throw error if user is not logged in', () => {
      return testQueryErrorCode(
        client,
        {
          query: MUTATION,
          variables: { id: currentJobId },
        },
        'UNAUTHENTICATED',
      );
    });

    it('should not delete any if the experience not belongs to user', async () => {
      loggedUser = '2';

      const res = await client.query<
        { removeExperience: { _: boolean } },
        { id: string }
      >(MUTATION, {
        variables: { id: currentJobId },
      });

      expect(res.data.removeExperience._).toBe(true);

      const experience = await con.getRepository(UserWorkExperience).findOne({
        where: { id: currentJobId },
      });

      expect(experience).toBeDefined();
      expect(experience).not.toBeNull();
      expect(experience).toEqual(
        expect.objectContaining({
          userId: '1',
        }),
      );
    });

    it('should remove the experience if it belongs to user', async () => {
      loggedUser = '1';
      const res = await client.query<
        { removeExperience: { _: boolean } },
        { id: string }
      >(MUTATION, {
        variables: { id: currentJobId },
      });

      expect(res.data.removeExperience._).toBe(true);

      // Verify that the experience is removed
      const userExperiences = await con
        .getRepository(UserWorkExperience)
        .findBy({ userId: loggedUser });

      expect(userExperiences).toHaveLength(4);
      expect(userExperiences).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: currentJobId })]),
      );
    });
  });

  describe('update experiences', () => {
    const MUTATION = `
    mutation UpdateExperience($id: ID!, $input: ExperienceUpdateInput!) {
      updateExperience(id: $id, input: $input){
        _
      }
    }
  `;

    const currentJobId = uuidv4();
    const currentEducationId = uuidv4();

    beforeEach(async () => {
      await saveFixtures(con, User, usersFixture);
      // Create test companies for education and work
      await saveFixtures(con, Company, [
        {
          id: 'school1',
          name: 'Stanford University',
          type: CompanyType.School,
          image: 'https://example.com/stanford.png',
        },
        {
          id: 'school2',
          name: 'MIT',
          type: CompanyType.School,
          image: 'https://example.com/mit.png',
        },
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
      ]);

      await saveFixtures(con, UserWorkExperience, [
        {
          id: currentJobId,
          userId: '1',
          title: 'Software Engineer',
          status: ExperienceStatus.Published,
          description: 'Building awesome software',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2021-01-31'),
          companyId: 'company1',
        },
      ]);

      await saveFixtures(con, UserEducationExperience, [
        {
          id: currentEducationId,
          userId: '1',
          title: 'Computer Science Degree',
          schoolId: 'school1',
          fieldOfStudy: 'Computer Science',
          grade: 'A',
          status: ExperienceStatus.Published,
          description: 'Bachelor of Science in Computer Science',
          startDate: new Date('2016-09-01'),
          endDate: new Date('2020-06-30'),
        },
      ]);
    });

    it('should throw error if user is not logged in', () => {
      return testQueryErrorCode(
        client,
        {
          query: MUTATION,
          variables: {
            id: currentJobId,
            input: {
              title: 'Updated Title',
              type: UserExperienceType.Work,
            },
          },
        },
        'UNAUTHENTICATED',
      );
    });

    it('should throw error if experience does not exist', () => {
      loggedUser = '1';
      return testQueryErrorCode(
        client,
        {
          query: MUTATION,
          variables: {
            id: uuidv4(),
            input: {
              title: 'Updated Title',
              type: UserExperienceType.Work,
            },
          },
        },
        'NOT_FOUND',
      );
    });

    it('should throw error if experience does not belong to user', () => {
      loggedUser = '2';
      return testQueryErrorCode(
        client,
        {
          query: MUTATION,
          variables: {
            id: currentJobId, // Experience belongs to user 1
            input: {
              title: 'Updated Title',
              type: UserExperienceType.Work,
            },
          },
        },
        'NOT_FOUND',
      );
    });

    it('should update work experience successfully', async () => {
      loggedUser = '1';
      const updatedTitle = 'Senior Software Engineer';
      const updatedDescription = 'Leading a team of developers';

      const res = await client.query(MUTATION, {
        variables: {
          id: currentJobId,
          input: {
            title: updatedTitle,
            description: updatedDescription,
            type: UserExperienceType.Work,
          },
        },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.updateExperience._).toBe(true);

      // Verify that the experience was updated
      const updatedExperience = await con
        .getRepository(UserWorkExperience)
        .findOneOrFail({
          where: { id: currentJobId },
        });

      expect(updatedExperience).toBeDefined();
      expect(updatedExperience.title).toEqual(updatedTitle);
      expect(updatedExperience.description).toEqual(updatedDescription);
    });

    it('should update education experience successfully', async () => {
      loggedUser = '1';
      const updatedTitle = 'Master of Computer Science';
      const updatedFieldOfStudy = 'Artificial Intelligence';
      const updatedGrade = 'A+';

      const res = await client.query(MUTATION, {
        variables: {
          id: currentEducationId,
          input: {
            title: updatedTitle,
            fieldOfStudy: updatedFieldOfStudy,
            grade: updatedGrade,
            type: UserExperienceType.Education,
          },
        },
      });

      expect(res.data.updateExperience._).toBe(true);

      // Verify that the experience was updated
      const updatedExperience = await con
        .getRepository(UserEducationExperience)
        .findOne({
          where: { id: currentEducationId },
        });

      expect(updatedExperience).toBeDefined();
      expect(updatedExperience?.title).toEqual(updatedTitle);
      expect(updatedExperience?.fieldOfStudy).toEqual(updatedFieldOfStudy);
      expect(updatedExperience?.grade).toEqual(updatedGrade);
    });

    it('should update status of an experience', async () => {
      loggedUser = '1';

      const res = await client.query(MUTATION, {
        variables: {
          id: currentJobId,
          input: {
            status: ExperienceStatus.Draft,
            type: UserExperienceType.Work,
          },
        },
      });

      expect(res.data.updateExperience._).toBe(true);

      // Verify that the status was updated
      const updatedExperience = await con
        .getRepository(UserWorkExperience)
        .findOneOrFail({
          where: { id: currentJobId },
        });

      expect(updatedExperience).toBeDefined();
      expect(updatedExperience.status).toEqual(ExperienceStatus.Draft);
    });
  });
});
