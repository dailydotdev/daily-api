const mockCreateIssue = jest.fn();
const mockIssueLabels = jest.fn();
const mockCreateIssueLabel = jest.fn();

jest.mock('@linear/sdk', () => ({
  LinearClient: jest.fn().mockImplementation(() => ({
    createIssue: (...args: unknown[]) => mockCreateIssue(...args),
    issueLabels: (...args: unknown[]) => mockIssueLabels(...args),
    createIssueLabel: (...args: unknown[]) => mockCreateIssueLabel(...args),
  })),
}));

jest.mock('../../../src/integrations/garmr', () => ({
  GarmrService: jest.fn().mockImplementation(() => ({
    execute: (fn: () => Promise<unknown>) => fn(),
  })),
}));

import { createFeedbackIssue } from '../../../src/integrations/linear';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.LINEAR_API_KEY = 'test-key';
  process.env.LINEAR_FEEDBACK_TEAM_ID = 'team-123';

  mockIssueLabels.mockResolvedValue({ nodes: [] });
  mockCreateIssueLabel.mockResolvedValue({
    issueLabel: { id: 'label-1' },
  });

  mockCreateIssue.mockResolvedValue({
    issue: Promise.resolve({
      id: 'issue-1',
      url: 'https://linear.app/issue/1',
    }),
  });
});

afterEach(() => {
  delete process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_FEEDBACK_TEAM_ID;
});

describe('createFeedbackIssue - Client Environment section', () => {
  const baseInput = {
    feedbackId: 'fb-1',
    userId: 'user-1',
    category: 1,
    description: 'Something is broken',
    pageUrl: 'https://app.daily.dev/feed',
    classification: {
      sentiment: '2',
      urgency: '3',
      tags: ['bug'],
      summary: 'Broken feature',
      hasPromptInjection: false,
      suggestedTeam: '1',
    },
  };

  it('should include full Client Environment table when all fields present', async () => {
    await createFeedbackIssue({
      ...baseInput,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      clientInfo: {
        viewport: '1920x1080',
        screen: '2560x1440',
        timezone: 'America/New_York',
        platform: 'MacIntel',
        language: 'en-US',
        theme: 'dark',
      },
    });

    const description = mockCreateIssue.mock.calls[0][0].description;
    expect(description).toContain('### Client Environment');
    expect(description).toContain('| **User Agent** |');
    expect(description).toContain('| **Viewport** | 1920x1080 |');
    expect(description).toContain('| **Screen** | 2560x1440 |');
    expect(description).toContain('| **Timezone** | America/New_York |');
    expect(description).toContain('| **Platform** | MacIntel |');
    expect(description).toContain('| **Language** | en-US |');
    expect(description).toContain('| **Theme** | dark |');
  });

  it('should omit Client Environment section when no client data present', async () => {
    await createFeedbackIssue(baseInput);

    const description = mockCreateIssue.mock.calls[0][0].description;
    expect(description).not.toContain('### Client Environment');
    expect(description).toContain("### User's Description");
  });

  it('should only render rows for present fields', async () => {
    await createFeedbackIssue({
      ...baseInput,
      userAgent: 'Mozilla/5.0',
      clientInfo: {
        viewport: '1024x768',
        theme: 'light',
      },
    });

    const description = mockCreateIssue.mock.calls[0][0].description;
    expect(description).toContain('### Client Environment');
    expect(description).toContain('| **User Agent** |');
    expect(description).toContain('| **Viewport** | 1024x768 |');
    expect(description).toContain('| **Theme** | light |');
    expect(description).not.toContain('| **Screen** |');
    expect(description).not.toContain('| **Timezone** |');
    expect(description).not.toContain('| **Platform** |');
    expect(description).not.toContain('| **Language** |');
  });

  it('should sanitize user agent containing markdown in Client Environment', async () => {
    await createFeedbackIssue({
      ...baseInput,
      userAgent: 'Mozilla/5.0 <script>alert("xss")</script>',
      clientInfo: {
        viewport: '1920x1080',
      },
    });

    const description = mockCreateIssue.mock.calls[0][0].description;
    expect(description).toContain('&lt;script&gt;');
    expect(description).not.toContain('<script>');
  });

  it('should render userAgent-only section when clientInfo is null', async () => {
    await createFeedbackIssue({
      ...baseInput,
      userAgent: 'Mozilla/5.0',
      clientInfo: null,
    });

    const description = mockCreateIssue.mock.calls[0][0].description;
    expect(description).toContain('### Client Environment');
    expect(description).toContain('| **User Agent** | Mozilla/5.0 |');
    expect(description).not.toContain('| **Viewport** |');
  });
});
