import { LinearClient } from '@linear/sdk';
import {
  UserFeedbackCategory,
  UserFeedbackSentiment,
  UserFeedbackTeam,
  UserFeedbackUrgency,
} from '@dailydotdev/schema';

import type { FeedbackClassification } from '../../entity/Feedback';
import { GarmrService, IGarmrClient } from '../garmr';
import {
  getCategoryDisplayName,
  getSentimentEmoji,
} from '../../common/feedback';

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
  category: number;
  description: string;
  pageUrl?: string | null;
  classification: FeedbackClassification | null;
  screenshotUrl?: string | null;
  consoleLogs?: string | null;
}

interface CreateFeedbackIssueResult {
  id: string;
  url: string;
}

const mapUrgencyToPriority = (urgency?: string): number =>
  Number(urgency) || UserFeedbackUrgency.MEDIUM;

const getCategoryLabelName = (category: number): string => {
  switch (category) {
    case UserFeedbackCategory.BUG:
      return 'bug';
    case UserFeedbackCategory.FEATURE_REQUEST:
      return 'feature-request';
    case UserFeedbackCategory.GENERAL:
      return 'general';
    case UserFeedbackCategory.OTHER:
      return 'other';
    default:
      return 'unknown';
  }
};

const getUrgencyDisplayName = (urgency?: string): string => {
  switch (Number(urgency)) {
    case UserFeedbackUrgency.CRITICAL:
      return '🔴 Critical';
    case UserFeedbackUrgency.HIGH:
      return '🟠 High';
    case UserFeedbackUrgency.MEDIUM:
      return '🟡 Medium';
    case UserFeedbackUrgency.LOW:
      return '🟢 Low';
    default:
      return 'Medium';
  }
};

const getSentimentDisplayName = (sentiment?: string): string => {
  switch (Number(sentiment)) {
    case UserFeedbackSentiment.POSITIVE:
      return 'Positive';
    case UserFeedbackSentiment.NEGATIVE:
      return 'Negative';
    case UserFeedbackSentiment.NEUTRAL:
      return 'Neutral';
    case UserFeedbackSentiment.MIXED:
      return 'Mixed';
    default:
      return 'Unknown';
  }
};

const getTeamDisplayName = (team?: string): string => {
  switch (Number(team)) {
    case UserFeedbackTeam.ENGINEERING:
      return 'Engineering';
    case UserFeedbackTeam.PRODUCT:
      return 'Product';
    case UserFeedbackTeam.SUPPORT:
      return 'Support';
    default:
      return 'Unassigned';
  }
};

/**
 * Sanitizes user content for Linear issue descriptions by escaping special markdown characters
 * to prevent unintended formatting or potential injection attacks.
 *
 * Transformations:
 * - Escapes triple backticks (```) to prevent code block injection
 * - Escapes markdown links [text](url) to prevent malicious link rendering
 * - Escapes HTML-like tags <tag> to prevent potential XSS or @ mentions (e.g., @huginn)
 * - Truncates to 2000 characters to stay within Linear's limits
 */
const sanitizeForLinear = (content: string): string =>
  content
    .replace(/```/g, '\\`\\`\\`') // Escape code blocks
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '\\[$1\\]\\($2\\)') // Escape markdown links
    .replace(/<([^>]+)>/g, '&lt;$1&gt;') // Escape HTML-like tags and @ mentions
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

  // Build screenshot section if present
  const screenshotSection = input.screenshotUrl
    ? `\n### Screenshot\n\n![Screenshot](${input.screenshotUrl})\n`
    : '';

  // Build console logs section if present (using details tag for collapsible)
  const consoleLogsSection = input.consoleLogs
    ? `\n### Console Logs\n\n<details>\n<summary>Click to expand console logs</summary>\n\n\`\`\`json\n${sanitizeForLinear(input.consoleLogs)}\n\`\`\`\n\n</details>\n`
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
${screenshotSection}${consoleLogsSection}
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
    `feedback-${getCategoryLabelName(input.category)}`,
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
