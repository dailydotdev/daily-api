import { DeepPartial } from 'typeorm';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { Organization } from '../../src/entity/Organization';
import { OpportunityKeyword } from '../../src/entity/OpportunityKeyword';
import { OpportunityState } from '@dailydotdev/schema';
import {
  OpportunityMatchStatus,
  OpportunityType,
} from '../../src/entity/opportunities/types';

export const organizationsFixture: DeepPartial<Organization>[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Daily Dev Inc',
    image: 'https://example.com/logo.png',
    website: 'https://daily.dev',
    description: 'A platform for developers',
    location: 'San Francisco',
  },
];

export const opportunitiesFixture: DeepPartial<Opportunity>[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    type: OpportunityType.Job,
    state: OpportunityState.LIVE,
    title: 'Senior Full Stack Developer',
    tldr: 'Join our team as a Senior Full Stack Developer',
    content: [
      {
        title: 'Job Description',
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
    ],
    meta: {
      title: 'Senior Full Stack Developer',
      content: 'Join our engineering team',
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    type: OpportunityType.Job,
    state: OpportunityState.LIVE,
    title: 'Frontend Developer',
    tldr: 'Build amazing user interfaces',
    content: [
      {
        title: 'Role Overview',
        content: 'Frontend Developer position...',
        html: '<p>Frontend Developer position...</p>',
      },
    ],
    meta: {
      title: 'Frontend Developer',
      content: 'UI/UX focused role',
    },
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
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
    opportunityId: '550e8400-e29b-41d4-a716-446655440002',
    keyword: 'webdev',
  },
];

export const opportunityMatchesFixture: DeepPartial<OpportunityMatch>[] = [
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '1',
    status: OpportunityMatchStatus.Pending,
    description: { description: 'Interested candidate' },
    createdAt: new Date('2023-01-03'),
    updatedAt: new Date('2023-01-03'),
  },
  {
    opportunityId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '2',
    status: OpportunityMatchStatus.CandidateAccepted,
    description: { description: 'Accepted candidate' },
    createdAt: new Date('2023-01-04'),
    updatedAt: new Date('2023-01-04'),
  },
];
