import { LinearClient } from '@linear/sdk';
import type { FeedbackClassification } from '../../entity/Feedback';
import { GarmrService, IGarmrClient } from '../garmr';

interface ILinearClient extends IGarmrClient {
  instance: LinearClient | null;
}

let linearClient: ILinearClient | null = null;

const garmrLinearService = new GarmrService({
  service: 'linear',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const getLinearClient = (): ILinearClient | null => {
  if (!process.env.LINEAR_API_KEY) {
    return null;
  }

  if (!linearClient) {
    linearClient = {
      instance: new LinearClient({
        apiKey: process.env.LINEAR_API_KEY,
      }),
      garmr: garmrLinearService,
    };
  }

  return linearClient;
};

interface CreateFeedbackIssueInput {
  feedbackId: string;
  userId: string;
  category: string;
  description: string;
  pageUrl?: string | null;
  classification: FeedbackClassification | null;
}

interface CreateFeedbackIssueResult {
  id: string;
  url: string;
}

const mapUrgencyToPriority = (urgency?: string): number => {
  switch (urgency) {
    case '1': // CRITICAL
      return 1;
    case '2': // HIGH
      return 2;
    case '3': // MEDIUM
      return 3;
    case '4': // LOW
      return 4;
    default:
      return 3;
  }
};

const getCategoryDisplayName = (category: string): string => {
  switch (category) {
    case 'BUG':
      return 'Bug Report';
    case 'FEATURE_REQUEST':
      return 'Feature Request';
    case 'GENERAL':
      return 'General Feedback';
    case 'OTHER':
      return 'Other';
    default:
      return 'Feedback';
  }
};

const getSentimentEmoji = (sentiment?: string): string => {
  switch (sentiment) {
    case '1': // POSITIVE
      return '😊';
    case '2': // NEGATIVE
      return '😟';
    case '3': // NEUTRAL
      return '😐';
    case '4': // MIXED
      return '🤔';
    default:
      return '📝';
  }
};

const getUrgencyDisplayName = (urgency?: string): string => {
  switch (urgency) {
    case '1': // CRITICAL
      return '🔴 Critical';
    case '2': // HIGH
      return '🟠 High';
    case '3': // MEDIUM
      return '🟡 Medium';
    case '4': // LOW
      return '🟢 Low';
    default:
      return 'Medium';
  }
};

const getSentimentDisplayName = (sentiment?: string): string => {
  switch (sentiment) {
    case '1':
      return 'Positive';
    case '2':
      return 'Negative';
    case '3':
      return 'Neutral';
    case '4':
      return 'Mixed';
    default:
      return 'Unknown';
  }
};

const getTeamDisplayName = (team?: string): string => {
  switch (team) {
    case '1':
      return 'Engineering';
    case '2':
      return 'Product';
    case '3':
      return 'Support';
    default:
      return 'Unassigned';
  }
};

const sanitizeForLinear = (content: string): string =>
  content
    .replace(/```/g, '\\`\\`\\`')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '\\[$1\\]\\($2\\)')
    .replace(/<([^>]+)>/g, '&lt;$1&gt;')
    .slice(0, 2000);

const buildIssueDescription = (input: CreateFeedbackIssueInput): string => {
  const { classification } = input;
  const sanitizedDescription = sanitizeForLinear(input.description);

  const sentimentEmoji = getSentimentEmoji(classification?.sentiment);
  const urgencyDisplay = getUrgencyDisplayName(classification?.urgency);
  const sentimentDisplay = getSentimentDisplayName(classification?.sentiment);
  const teamDisplay = getTeamDisplayName(classification?.suggestedTeam);
  const categoryDisplay = getCategoryDisplayName(input.category);
  const tagsDisplay = classification?.tags?.length
    ? classification.tags.join(', ')
    : 'None';

  const warningSection = classification?.hasPromptInjection
    ? `> ⚠️ **Warning**: Potential prompt injection detected in this feedback\n\n`
    : '';

  return `${warningSection}## User Feedback ${sentimentEmoji}

| Field | Value |
|-------|-------|
| **Category** | ${categoryDisplay} |
| **Sentiment** | ${sentimentDisplay} |
| **Urgency** | ${urgencyDisplay} |
| **Suggested Team** | ${teamDisplay} |
| **Tags** | ${tagsDisplay} |
| **Page URL** | ${input.pageUrl || 'N/A'} |

### User's Description

\`\`\`
${sanitizedDescription}
\`\`\`

### Metadata

- **Feedback ID**: \`${input.feedbackId}\`
- **User ID**: \`${input.userId}\`
`;
};

export const createFeedbackIssue = async (
  input: CreateFeedbackIssueInput,
): Promise<CreateFeedbackIssueResult | null> => {
  const client = getLinearClient();
  if (!client || !client.instance) {
    return null;
  }

  const teamId = process.env.LINEAR_FEEDBACK_TEAM_ID;
  if (!teamId) {
    return null;
  }

  return client.garmr.execute(async () => {
    const priority = mapUrgencyToPriority(input.classification?.urgency);
    const categoryDisplay = getCategoryDisplayName(input.category);
    const description = buildIssueDescription(input);

    // Use AI-generated summary if available, otherwise fall back to first line
    const title = input.classification?.summary
      ? `[Feedback] ${categoryDisplay}: ${input.classification.summary.slice(0, 80)}`
      : (() => {
          const firstLine = input.description.trim().split('\n')[0];
          return `[Feedback] ${categoryDisplay}: ${firstLine.slice(0, 80)}${firstLine.length > 80 ? '...' : ''}`;
        })();

    const issuePayload = await client.instance!.createIssue({
      teamId,
      title,
      description,
      priority,
      labelIds: await getOrCreateLabels(client.instance!, teamId, input),
    });

    const issue = await issuePayload.issue;
    if (!issue) {
      return null;
    }

    return {
      id: issue.id,
      url: issue.url,
    };
  });
};

const getOrCreateLabels = async (
  linearInstance: LinearClient,
  teamId: string,
  input: CreateFeedbackIssueInput,
): Promise<string[]> => {
  const labelNames = [
    'user-feedback',
    `feedback-${input.category.toLowerCase().replace('_', '-')}`,
    // Add classification tags as labels (prefixed to avoid conflicts)
    ...(input.classification?.tags?.map((tag) => `tag-${tag}`) ?? []),
  ];

  try {
    const existingLabels = await linearInstance.issueLabels({
      filter: { team: { id: { eq: teamId } } },
    });

    const existingMap = new Map(
      existingLabels.nodes.map((l) => [l.name, l.id]),
    );
    const result: string[] = [];

    for (const name of labelNames) {
      if (existingMap.has(name)) {
        result.push(existingMap.get(name)!);
      } else {
        const color =
          name === 'user-feedback'
            ? '#6366f1'
            : name.startsWith('tag-')
              ? '#10b981'
              : '#8b5cf6';
        const payload = await linearInstance.createIssueLabel({
          teamId,
          name,
          color,
        });
        const label = await payload.issueLabel;
        if (label) {
          result.push(label.id);
        }
      }
    }

    return result;
  } catch {
    return [];
  }
};
