import type {
  EngagementCreative,
  SkadiResponse,
} from '../../integrations/skadi/types';

const logo = {
  dark: 'https://cdn.simpleicons.org/googlecloud/white',
  light: 'https://cdn.simpleicons.org/googlecloud/4285F4',
};

const mockEngagementCreative: EngagementCreative = {
  gen_id: 'mock-engagement-gen-id',
  promoted_name: 'Google Cloud',
  promoted_body:
    'Get $300 in free credits to build, test, and ship your next project on Google Cloud, on us.',
  promoted_cta: 'Claim credits',
  promoted_url: 'https://cloud.google.com/free',
  promoted_logo_img: logo,
  promoted_icon_img: logo,
  promoted_gradient_start: { dark: '#4285F4', light: '#4285F4' },
  promoted_gradient_end: { dark: '#34A853', light: '#34A853' },
  // Drives the mentioned-tools widget on the post page (one sponsored tool per
  // entry). Kept to recognizable Google Cloud products.
  tools: ['BigQuery', 'Vertex AI', 'Gemini', 'Kubernetes', 'Cloud Run'],
  // Highlighted-word scanner looks these up in post titles/content first
  // (falls back to tags). Common words so they actually appear in the feed.
  keywords: ['AI', 'cloud', 'Kubernetes', 'serverless', 'Gemini', 'deploy'],
  // Tag overlap is what lights up the branded upvote animation + sponsored
  // tag chip. Broad, common dev tags so the micro-interactions fire across a
  // normal feed (this is a test mock — a real campaign would scope these).
  tags: [
    'cloud',
    'ai',
    'devops',
    'kubernetes',
    'machine-learning',
    'webdev',
    'javascript',
  ],
  placements: ['top_banner', 'feed_strip'],
  source_id: 'mock-cpa-source',
};

export const mockSkadiEngagementResponse: SkadiResponse<{
  engagement: EngagementCreative;
}> = {
  type: 'engagement',
  value: { engagement: mockEngagementCreative },
  generation_id: 'mock-engagement-gen-id',
};
