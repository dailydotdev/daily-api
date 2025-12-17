import { FastifyInstance } from 'fastify';

// Record types matching the webapp's RecordType enum
const RecordType = {
  YEAR_ACTIVE: 'yearActive',
  STREAK: 'streak',
  CONSISTENT_DAY: 'consistentDay',
  BINGE_DAY: 'bingeDay',
  LONGEST_SESSION: 'longestSession',
  TOPIC_MARATHON: 'topicMarathon',
  LATE_NIGHT: 'lateNight',
  EARLY_MORNING: 'earlyMorning',
  GROWTH_MONTH: 'growthMonth',
  IMPROVED_TOPIC: 'improvedTopic',
} as const;

// Mock data matching the webapp's LogData interface
// TODO: Replace with actual data fetching logic
const MOCK_LOG_DATA = {
  // Card 1: Total Impact
  totalPosts: 847,
  totalReadingTime: 62,
  daysActive: 234,
  totalImpactPercentile: 91,

  // Card 2: When You Read
  peakDay: 'Thursday',
  readingPattern: 'night',
  patternPercentile: 8,
  activityHeatmap: Array(7)
    .fill(null)
    .map(() =>
      Array(24)
        .fill(0)
        .map(() => Math.floor(Math.random() * 10)),
    ),

  // Card 3: Topic Evolution
  topicJourney: [
    { quarter: 'Q1', topics: ['Python', 'Django', 'REST APIs'] },
    {
      quarter: 'Q2',
      topics: ['Docker', 'Kubernetes', 'DevOps'],
      comment: '🔥 THE PIVOT QUARTER',
    },
    { quarter: 'Q3', topics: ['Go', 'Concurrency', 'gRPC'] },
    { quarter: 'Q4', topics: ['Rust', 'Systems', 'Memory Safety'] },
  ],
  uniqueTopics: 47,
  evolutionPercentile: 23,

  // Card 4: Favorite Sources
  topSources: [
    {
      name: 'dev.to',
      postsRead: 127,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/devto',
    },
    {
      name: 'Hacker News',
      postsRead: 98,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/hn',
    },
    {
      name: 'Pragmatic Engineer',
      postsRead: 64,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/pragmaticengineer',
    },
  ],
  uniqueSources: 89,
  sourcePercentile: 15,
  sourceLoyaltyName: 'dev.to',

  // Card 5: Community Engagement
  upvotesGiven: 234,
  commentsWritten: 18,
  postsBookmarked: 89,
  upvotePercentile: 15,
  commentPercentile: 32,
  bookmarkPercentile: 20,

  // Card 6: Your Contributions
  hasContributions: true,
  postsCreated: 12,
  totalViews: 8432,
  commentsReceived: 247,
  upvotesReceived: 892,
  reputationEarned: 1892,
  creatorPercentile: 8,

  // Card 7: Records
  records: [
    {
      type: RecordType.STREAK,
      label: 'Longest Streak',
      value: '47 days',
      percentile: 6,
    },
    {
      type: RecordType.BINGE_DAY,
      label: 'Biggest Binge',
      value: '34 posts on Mar 12',
      percentile: 3,
    },
    {
      type: RecordType.LATE_NIGHT,
      label: 'Latest Night Read',
      value: '3:47 AM',
    },
  ],

  // Card 8: Archetype
  archetype: 'COLLECTOR',
  archetypeStat: 'Only 12% of developers read as late as you',
  archetypePercentile: 12,

  // Card 9: Share
  globalRank: 12847,
  totalDevelopers: 487000,
  shareCount: 24853,
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // TODO: Replace mock data with actual user data based on req.userId
    return res.send(MOCK_LOG_DATA);
  });
}
