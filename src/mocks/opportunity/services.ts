/**
 * Mock service responses for opportunity-related external services.
 * Only the actual service calls are mocked - all other flow logic remains unchanged.
 */

import {
  EmploymentType,
  OpportunityType,
  SalaryPeriod,
  SeniorityLevel,
} from '@dailydotdev/schema';

/**
 * Check if external services should be mocked
 */
export const isMockEnabled = (): boolean =>
  process.env.MOCK_EXTERNAL_SERVICES === 'true';

/**
 * Mock response for Brokkr parseOpportunity service call
 * Returns plain objects that match the expected protobuf message shape
 */
export const mockBrokkrParseOpportunityResponse = () => ({
  opportunity: {
    type: OpportunityType.JOB,
    title: 'Senior Full Stack Developer',
    tldr: 'Join our team to build cutting-edge developer tools and shape the future of how developers discover content.',
    content: {
      overview: {
        content:
          'We are looking for a Senior Full Stack Developer to join our growing engineering team. You will work on building and scaling our platform that serves millions of developers worldwide.',
      },
      responsibilities: {
        content:
          '- Design and implement new features across the full stack\n- Collaborate with product and design teams\n- Mentor junior developers\n- Participate in code reviews and architectural decisions',
      },
      requirements: {
        content:
          '- 5+ years of experience with modern web technologies\n- Strong proficiency in TypeScript and React\n- Experience with Node.js and PostgreSQL\n- Excellent communication skills',
      },
    },
    meta: {
      roleType: 0.0,
      teamSize: 15,
      seniorityLevel: SeniorityLevel.SENIOR,
      employmentType: EmploymentType.FULL_TIME,
      salary: {
        min: BigInt(120000),
        max: BigInt(130000),
        currency: 'USD',
        period: SalaryPeriod.ANNUAL,
      },
      equity: true,
    },
    keywords: ['typescript', 'react', 'nodejs', 'postgresql', 'graphql'],
  },
});

/**
 * Mock response for Gondul screeningQuestions service call
 */
export const mockGondulScreeningQuestionsResponse = () => ({
  screening: [
    'What experience do you have building and scaling applications for millions of users?',
    'How do you approach mentoring junior developers while maintaining your own productivity?',
    'Describe your experience with TypeScript and React in production.',
  ],
});

/**
 * Mock user IDs for opportunityPreview (simulates Gondul preview response)
 * These should be valid user IDs from your local database (from seed data)
 * Using testuser1-10 which have SourceMember entries for publicsquad
 */
export const mockPreviewUserIds = [
  'testuser',
  'testuser1',
  'testuser2',
  'testuser3',
  'testuser4',
  'testuser5',
  'testuser6',
  'testuser7',
  'testuser8',
  'testuser9',
];
export const mockPreviewTotalCount = 4827;

/**
 * Mock tags for opportunityPreview result
 * These are used when computing the aggregated tags from user data
 */
export const mockPreviewTags = [
  'react',
  'typescript',
  'javascript',
  'nodejs',
  'python',
  'graphql',
  'nextjs',
  'aws',
];

/**
 * Mock squads for opportunityPreview result
 * These should match squad IDs from the seed data
 */
export const mockPreviewSquadIds = ['publicsquad'];

/**
 * Mock PDF buffer for scraper service (minimal valid PDF)
 */
export const mockScraperPdfBuffer = (): Buffer => {
  // Minimal PDF structure
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
};

/**
 * Mock engagement profile returned from Snotra getProfile
 */
export const mockSnotraEngagementProfile = {
  profile_text:
    'Active developer with strong engagement in React and TypeScript communities. Regular contributor to open source projects and frequent reader of frontend development content. Shows consistent interest in modern web technologies and best practices.',
  update_at: new Date().toISOString(),
};
