import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AchievementType {
  Instant = 'instant', // One-time action (e.g., update profile picture)
  Streak = 'streak', // Consecutive actions (future use)
  Milestone = 'milestone', // Cumulative count (e.g., upvote 10 posts)
  Multipart = 'multipart', // Multiple criteria (future use)
}

export enum AchievementEventType {
  PostUpvote = 'post_upvote',
  CommentUpvote = 'comment_upvote',
  BookmarkPost = 'bookmark_post',
  ProfileImageUpdate = 'profile_image_update',
  ProfileCoverUpdate = 'profile_cover_update',
  ProfileLocationUpdate = 'profile_location_update',
  ExperienceWork = 'experience_work',
  ExperienceEducation = 'experience_education',
  ExperienceOpenSource = 'experience_opensource',
  ExperienceProject = 'experience_project',
  ExperienceVolunteering = 'experience_volunteering',
  ExperienceSkill = 'experience_skill',
  HotTakeCreate = 'hot_take_create',
  PostShare = 'post_share',
  PostFreeform = 'post_freeform',
  SquadJoin = 'squad_join',
  SquadCreate = 'squad_create',
  BriefRead = 'brief_read',
  ReputationGain = 'reputation_gain',
  ExperienceCertification = 'experience_certification',
  CVUpload = 'cv_upload',
  CommentCreate = 'comment_create',
  FeedCreate = 'feed_create',
  BookmarkListCreate = 'bookmark_list_create',
  PostBoost = 'post_boost',
  UpvoteReceived = 'upvote_received',
  AwardReceived = 'award_received',
  AwardGiven = 'award_given',
  UserFollow = 'user_follow',
  FollowerGain = 'follower_gain',
  PlusSubscribe = 'plus_subscribe',
  SubscriptionAnniversary = 'subscription_anniversary',
  TopReaderBadge = 'top_reader_badge',
  ReadingStreak = 'reading_streak',
  ProfileComplete = 'profile_complete',
  ShareClick = 'share_click',
  ShareClickMilestone = 'share_click_milestone',
  SharePostsClicked = 'share_posts_clicked',
}

export interface AchievementCriteria {
  targetCount?: number; // For milestone achievements
  metadata?: Record<string, unknown>; // Additional criteria data
}

@Entity()
export class Achievement {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_achievement_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  image: string;

  @Column({ type: 'text' })
  @Index('IDX_achievement_type_value')
  type: AchievementType;

  @Column({ type: 'text' })
  @Index('IDX_achievement_eventType_value')
  eventType: AchievementEventType;

  @Column({ type: 'jsonb', default: {} })
  criteria: AchievementCriteria;

  @Column({ type: 'smallint', default: 5 })
  points: number;
}
