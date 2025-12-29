/**
 * Mock data for opportunity-related external services.
 * Used when MOCK_EXTERNAL_SERVICES=true to enable local development
 * without access to Gondul, Brokkr, Snotra services.
 *
 * To enable: Set MOCK_EXTERNAL_SERVICES=true in your .env file
 * To disable: Remove or set to false before committing
 */

import {
  EmploymentType,
  OpportunityType,
  SalaryPeriod,
  SeniorityLevel,
} from '@dailydotdev/schema';
import { OpportunityPreviewStatus } from '../../common/opportunity/types';

/**
 * Check if external services should be mocked
 */
export const isMockEnabled = (): boolean =>
  process.env.MOCK_EXTERNAL_SERVICES === 'true';

/**
 * Mock parsed opportunity data returned from Brokkr parseOpportunity
 * Uses plain objects with integer enum values for proper JSONB storage
 */
export const mockParsedOpportunity = {
  type: OpportunityType.JOB, // 1
  title: 'Senior Full Stack Developer',
  tldr: 'Join our team to build cutting-edge developer tools and shape the future of how developers discover content.',
  // Plain object for JSONB storage (not protobuf class)
  content: {
    overview: {
      content:
        'We are looking for a Senior Full Stack Developer to join our growing engineering team. You will work on building and scaling our platform that serves millions of developers worldwide.',
      html: '<p>We are looking for a Senior Full Stack Developer to join our growing engineering team. You will work on building and scaling our platform that serves millions of developers worldwide.</p>',
    },
    responsibilities: {
      content:
        '- Design and implement new features across the full stack\n- Collaborate with product and design teams\n- Mentor junior developers\n- Participate in code reviews and architectural decisions',
      html: '<ul><li>Design and implement new features across the full stack</li><li>Collaborate with product and design teams</li><li>Mentor junior developers</li><li>Participate in code reviews and architectural decisions</li></ul>',
    },
    requirements: {
      content:
        '- 5+ years of experience with modern web technologies\n- Strong proficiency in TypeScript and React\n- Experience with Node.js and PostgreSQL\n- Excellent communication skills',
      html: '<ul><li>5+ years of experience with modern web technologies</li><li>Strong proficiency in TypeScript and React</li><li>Experience with Node.js and PostgreSQL</li><li>Excellent communication skills</li></ul>',
    },
  },
  // Plain object with integer enum values for JSONB storage
  meta: {
    roleType: 0.0,
    teamSize: 15,
    seniorityLevel: SeniorityLevel.SENIOR, // 4
    employmentType: EmploymentType.FULL_TIME, // 1
    salary: {
      min: 120000,
      max: 180000,
      currency: 'USD',
      period: SalaryPeriod.ANNUAL, // 1
    },
    equity: true,
  },
  keywords: [
    { keyword: 'typescript' },
    { keyword: 'react' },
    { keyword: 'nodejs' },
    { keyword: 'postgresql' },
    { keyword: 'graphql' },
  ],
};

/**
 * Mock screening questions returned from Gondul screeningQuestions
 */
export const mockScreeningQuestions = [
  {
    title:
      'What experience do you have building and scaling applications for millions of users?',
    placeholder:
      'Describe a project where you handled high traffic and what challenges you faced.',
  },
  {
    title:
      'How do you approach mentoring junior developers while maintaining your own productivity?',
    placeholder: 'Share your strategies for knowledge sharing and team growth.',
  },
  {
    title: 'Describe your experience with TypeScript and React in production.',
    placeholder:
      'Include any patterns or practices you find particularly effective.',
  },
];

/**
 * Mock preview data for opportunityPreview query (simulates Gondul preview response)
 * These should be valid user IDs from your local database (from seed data)
 */
export const mockPreviewData = {
  userIds: ['1', '2', '3', '4'],
  totalCount: 4827,
  status: OpportunityPreviewStatus.READY,
};

/**
 * Mock engagement profile returned from Snotra getProfile
 */
export const mockEngagementProfile = {
  profile_text:
    'Active developer with strong engagement in React and TypeScript communities. Regular contributor to open source projects and frequent reader of frontend development content. Shows consistent interest in modern web technologies and best practices.',
  update_at: new Date().toISOString(),
};
