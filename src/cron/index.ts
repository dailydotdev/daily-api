import { Cron } from './cron';
import interestScheduledRun from './interestScheduledRun';
import updateViews from './updateViews';
import checkAnalyticsReport from './checkAnalyticsReport';
import updateTrending from './updateTrending';
import updateTagsStr from './updateTagsStr';
import cleanZombieUsers from './cleanZombieUsers';
import cleanZombieImages from './cleanZombieImages';
import personalizedDigest from './personalizedDigest';
import generateSearchInvites from './generateSearchInvites';
import checkReferralReminder from './checkReferralReminder';
import dailyDigest from './dailyDigest';
import updateHighlightedViews from './updateHighlightedViews';
import hourlyNotifications from './hourlyNotifications';
import updateCurrentStreak from './updateCurrentStreak';
import syncSubscriptionWithCIO from './syncSubscriptionWithCIO';
import validateActiveUsers from './validateActiveUsers';
import { updateSourcePublicThreshold } from './updateSourcePublicThreshold';
import { cleanZombieUserCompany } from './cleanZombieUserCompany';
import { calculateTopReaders } from './calculateTopReaders';
import cleanGiftedPlus from './cleanGiftedPlus';
import { cleanStaleUserTransactions } from './cleanStaleUserTransactions';
import { postAnalyticsClickhouseCron } from './postAnalyticsClickhouse';
import { postAnalyticsAchievementsCron } from './postAnalyticsAchievements';
import { postAnalyticsHistoryDayClickhouseCron } from './postAnalyticsHistoryDayClickhouse';
import { postLifecycleStateClickhouseCron } from './postLifecycleStateClickhouse';
import { userPostsAnalyticsRefreshCron } from './userPostsAnalyticsRefresh';
import { squadPostsAnalyticsRefreshCron } from './squadPostsAnalyticsRefresh';
import { userProfileAnalyticsClickhouseCron } from './userProfileAnalyticsClickhouse';
import { userProfileAnalyticsHistoryClickhouseCron } from './userProfileAnalyticsHistoryClickhouse';
import { cleanZombieOpportunities } from './cleanZombieOpportunities';
import { userProfileUpdatedSync } from './userProfileUpdatedSync';
import expireSuperAgentTrial from './expireSuperAgentTrial';
import updateAchievementRarity from './updateAchievementRarity';
import rotateDailyQuests from './rotateDailyQuests';
import rotateWeeklyQuests from './rotateWeeklyQuests';
import backfillGearCategory from './backfillGearCategory';
import channelDigests from './channelDigests';
import channelHighlights from './channelHighlights';
import { cleanExpiredBetterAuthSessions } from './cleanExpiredBetterAuthSessions';
import { cleanChannelHighlights } from './cleanChannelHighlights';
import updateTagMaterializedViews from './updateTagMaterializedViews';
import { materializeMonthlyBestPostArchives } from './materializeMonthlyBestPostArchives';
import { materializeYearlyBestPostArchives } from './materializeYearlyBestPostArchives';
import cleanOldNotifications from './cleanOldNotifications';
import { subscriptionAnniversaryAchievementsCron } from './subscriptionAnniversaryAchievements';

export const crons: Cron[] = [
  interestScheduledRun,
  updateViews,
  checkAnalyticsReport,
  updateTrending,
  updateTagsStr,
  cleanZombieUsers,
  cleanZombieImages,
  personalizedDigest,
  generateSearchInvites,
  checkReferralReminder,
  dailyDigest,
  updateHighlightedViews,
  hourlyNotifications,
  updateCurrentStreak,
  syncSubscriptionWithCIO,
  cleanZombieUserCompany,
  updateSourcePublicThreshold,
  calculateTopReaders,
  validateActiveUsers,
  cleanGiftedPlus,
  cleanStaleUserTransactions,
  postAnalyticsClickhouseCron,
  postAnalyticsAchievementsCron,
  postAnalyticsHistoryDayClickhouseCron,
  postLifecycleStateClickhouseCron,
  userPostsAnalyticsRefreshCron,
  squadPostsAnalyticsRefreshCron,
  userProfileAnalyticsClickhouseCron,
  userProfileAnalyticsHistoryClickhouseCron,
  cleanZombieOpportunities,
  userProfileUpdatedSync,
  expireSuperAgentTrial,
  updateAchievementRarity,
  rotateDailyQuests,
  rotateWeeklyQuests,
  backfillGearCategory,
  channelDigests,
  channelHighlights,
  cleanChannelHighlights,
  cleanExpiredBetterAuthSessions,
  updateTagMaterializedViews,
  materializeMonthlyBestPostArchives,
  materializeYearlyBestPostArchives,
  cleanOldNotifications,
  subscriptionAnniversaryAchievementsCron,
];
