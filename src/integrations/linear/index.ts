import { LinearClient } from '@linear/sdk';
import type { FeedbackClassification } from '../../entity/Feedback';

let linearClient: LinearClient | null = null;

export const getLinearClient = (): LinearClient | null => {
  if (!process.env.LINEAR_API_KEY) {
    return null;
  }

  if (!linearClient) {
    linearClient = new LinearClient({
      apiKey: process.env.LINEAR_API_KEY,
    });
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
    case 'FEEDBACK_URGENCY_CRITICAL':
      return 1;
    case 'FEEDBACK_URGENCY_HIGH':
      return 2;
    case 'FEEDBACK_URGENCY_MEDIUM':
      return 3;
    case 'FEEDBACK_URGENCY_LOW':
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
    case 'FEEDBACK_SENTIMENT_POSITIVE':
      return '😊';
    case 'FEEDBACK_SENTIMENT_NEGATIVE':
      return '😟';
    case 'FEEDBACK_SENTIMENT_NEUTRAL':
      return '😐';
    default:
      return '📝';
  }
};

const getUrgencyDisplayName = (urgency?: string): string => {
  switch (urgency) {
    case 'FEEDBACK_URGENCY_CRITICAL':
      return '🔴 Critical';
    case 'FEEDBACK_URGENCY_HIGH':
      return '🟠 High';
    case 'FEEDBACK_URGENCY_MEDIUM':
      return '🟡 Medium';
    case 'FEEDBACK_URGENCY_LOW':
      return '🟢 Low';
    default:
      return 'Medium';
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
  const categoryDisplay = getCategoryDisplayName(input.category);

  return `## User Feedback ${sentimentEmoji}

| Field | Value |
|-------|-------|
| **Category** | ${categoryDisplay} |
| **Sentiment** | ${classification?.sentiment?.replace('FEEDBACK_SENTIMENT_', '') || 'Unknown'} |
| **Urgency** | ${urgencyDisplay} |
| **Page URL** | ${input.pageUrl || 'N/A'} |

### User's Description

\`\`\`
${sanitizedDescription}
\`\`\`

### Metadata

- **Feedback ID**: \`${input.feedbackId}\`
- **User ID**: \`${input.userId}\`
- **Platform**: ${classification?.platform?.replace('FEEDBACK_PLATFORM_', '') || 'Unknown'}
`;
};

export const createFeedbackIssue = async (
  input: CreateFeedbackIssueInput,
): Promise<CreateFeedbackIssueResult | null> => {
  const client = getLinearClient();
  if (!client) {
    return null;
  }

  const teamId = process.env.LINEAR_FEEDBACK_TEAM_ID;
  if (!teamId) {
    return null;
  }

  const priority = mapUrgencyToPriority(input.classification?.urgency);
  const categoryDisplay = getCategoryDisplayName(input.category);
  const description = buildIssueDescription(input);

  const firstLine = input.description.trim().split('\n')[0];
  const title = `[Feedback] ${categoryDisplay}: ${firstLine.slice(0, 80)}${firstLine.length > 80 ? '...' : ''}`;

  const issuePayload = await client.createIssue({
    teamId,
    title,
    description,
    priority,
    labelIds: await getOrCreateLabels(client, teamId, input),
  });

  const issue = await issuePayload.issue;
  if (!issue) {
    return null;
  }

  return {
    id: issue.id,
    url: issue.url,
  };
};

const getOrCreateLabels = async (
  client: LinearClient,
  teamId: string,
  input: CreateFeedbackIssueInput,
): Promise<string[]> => {
  const labelNames = [
    'user-feedback',
    `feedback-${input.category.toLowerCase().replace('_', '-')}`,
  ];

  try {
    const existingLabels = await client.issueLabels({
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
        const color = name === 'user-feedback' ? '#6366f1' : '#8b5cf6';
        const payload = await client.createIssueLabel({
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
