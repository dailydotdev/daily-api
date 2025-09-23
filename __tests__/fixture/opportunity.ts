import { DeepPartial } from 'typeorm';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { Organization } from '../../src/entity/Organization';
import { OpportunityKeyword } from '../../src/entity/OpportunityKeyword';
import {
  EmploymentType,
  LocationType,
  OpportunityState,
  OpportunityType,
  SalaryPeriod,
  SeniorityLevel,
} from '@dailydotdev/schema';
import { OpportunityMatchStatus } from '../../src/entity/opportunities/types';
import type { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import {
  OrganizationLinkType,
  SocialMediaType,
} from '../../src/common/schema/organizations';
import type { QuestionScreening } from '../../src/entity/questions/QuestionScreening';
import { demoCompany } from '../../src/common';

export const organizationsFixture: DeepPartial<Organization>[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Daily Dev Inc',
    image: 'https://example.com/logo.png',
    website: 'https://daily.dev',
    description: 'A platform for developers',
    location: 'San Francisco',
    links: [
      {
        type: OrganizationLinkType.Custom,
        title: 'Custom Link',
        link: 'https://custom.link',
      },
      {
        type: OrganizationLinkType.Custom,
        title: 'Custom Link 2',
        link: 'https://custom2.link',
      },
      {
        type: OrganizationLinkType.Social,
        socialType: SocialMediaType.Facebook,
        link: 'https://facebook.com',
      },
      {
        type: OrganizationLinkType.Press,
        title: 'Press link',
        link: 'https://press.link',
      },
    ],
  },
  {
    id: 'ed487a47-6f4d-480f-9712-f48ab29db27c',
    name: 'Yearly Dev Inc',
    image: 'https://example.com/logo.png',
    website: 'https://yearly.dev',
    description: 'A platform for others',
    location: 'Skatval',
    links: [],
  },
  {
    id: demoCompany.id,
    name: 'Demo Dev Inc',
    image: 'https://example.com/logo.png',
    website: 'https://monthly.dev',
    description: 'Another platform for developers',
    location: 'Oslo',
    links: [],
  },
];

export const opportunitiesFixture: DeepPartial<OpportunityJob>[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    type: OpportunityType.JOB,
    state: OpportunityState.LIVE,
    title: 'Senior Full Stack Developer',
    tldr: 'Join our team as a Senior Full Stack Developer',
    content: {
      overview: {
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 10,
      seniorityLevel: SeniorityLevel.SENIOR,
      employmentType: EmploymentType.FULL_TIME,
      salary: {
        min: 60000,
        max: 120000,
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    location: [
      {
        type: LocationType.REMOTE,
        country: 'Norway',
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    type: OpportunityType.JOB,
    state: OpportunityState.LIVE,
    title: 'Frontend Developer',
    tldr: 'Build amazing user interfaces',
    content: {
      overview: {
        content: 'Frontend Developer position...',
        html: '<p>Frontend Developer position...</p>',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 10,
      seniorityLevel: SeniorityLevel.JUNIOR,
      employmentType: EmploymentType.INTERNSHIP,
      salary: {
        min: 60000,
        max: 120000,
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
    },
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    location: [
      {
        type: LocationType.HYBRID,
        country: 'USA',
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    type: OpportunityType.JOB,
    state: OpportunityState.DRAFT,
    title: 'Senior Full Stack Developer',
    tldr: 'Join our team as a Senior Full Stack Developer',
    content: {
      overview: {
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 10,
      seniorityLevel: SeniorityLevel.SENIOR,
      employmentType: EmploymentType.FULL_TIME,
      salary: {
        min: 60000,
        max: 120000,
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    location: [
      {
        type: LocationType.REMOTE,
        country: 'Norway',
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    type: OpportunityType.JOB,
    state: OpportunityState.DRAFT,
    title: 'Frontend Developer',
    tldr: 'Build amazing user interfaces',
    content: {
      overview: {
        content: 'Frontend Developer position...',
        html: '<p>Frontend Developer position...</p>',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 10,
      seniorityLevel: SeniorityLevel.JUNIOR,
      employmentType: EmploymentType.INTERNSHIP,
      salary: {
        min: 60000,
        max: 120000,
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
    },
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    organizationId: 'ed487a47-6f4d-480f-9712-f48ab29db27c',
    location: [
      {
        type: LocationType.HYBRID,
        country: 'USA',
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    type: OpportunityType.JOB,
    state: OpportunityState.LIVE,
    title: 'Senior Full Stack Developer',
    tldr: 'Join our team as a Senior Full Stack Developer',
    content: {
      overview: {
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 10,
      seniorityLevel: SeniorityLevel.SENIOR,
      employmentType: EmploymentType.FULL_TIME,
      salary: {
        min: 60000,
        max: 120000,
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    organizationId: demoCompany.id,
    location: [
      {
        type: LocationType.REMOTE,
        country: 'Norway',
      },
    ],
  },
];

export const opportunityQuestionsFixture: DeepPartial<QuestionScreening>[] = [
  {
    id: '750e8400-e29b-41d4-a716-446655440001',
    title: 'What is your favorite programming language?',
    placeholder: 'e.g., JavaScript, Python, etc.',
    opportunityId: opportunitiesFixture[0].id,
    questionOrder: 1,
  },
  {
    id: '750e8400-e29b-41d4-a716-446655440002',
    title: 'Describe a challenging project you worked on.',
    placeholder: 'Your answer here...',
    opportunityId: opportunitiesFixture[0].id,
    questionOrder: 0,
  },
  {
    id: '750e8400-e29b-41d4-a716-446655440003',
    title: 'What are your career goals?',
    placeholder: 'Your answer here...',
    opportunityId: opportunitiesFixture[1].id,
    questionOrder: 0,
  },
];

export const opportunityKeywordsFixture: DeepPartial<OpportunityKeyword>[] = [
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    keyword: 'webdev',
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    keyword: 'fullstack',
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    keyword: 'Fortune 500',
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440002',
    keyword: 'webdev',
  },
];

export const opportunityMatchesFixture: DeepPartial<OpportunityMatch>[] = [
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '1',
    status: OpportunityMatchStatus.Pending,
    description: { reasoning: 'Interested candidate' },
    createdAt: new Date('2023-01-03'),
    updatedAt: new Date('2023-01-03'),
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '2',
    status: OpportunityMatchStatus.CandidateAccepted,
    description: { reasoning: 'Accepted candidate' },
    createdAt: new Date('2023-01-04'),
    updatedAt: new Date('2023-01-04'),
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440003',
    userId: '1',
    status: OpportunityMatchStatus.Pending,
    description: { reasoning: 'Interested candidate' },
    createdAt: new Date('2023-01-03'),
    updatedAt: new Date('2023-01-03'),
  },
];
