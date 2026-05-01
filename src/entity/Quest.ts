import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum QuestType {
  Daily = 'daily',
  Weekly = 'weekly',
  Milestone = 'milestone',
  Intro = 'intro',
}

export enum QuestEventType {
  PostUpvote = 'post_upvote',
  AwardGiven = 'award_given',
  SharePostClick = 'share_post_click',
  CommentUpvote = 'comment_upvote',
  CommentCreate = 'comment_create',
  BookmarkPost = 'bookmark_post',
  BriefRead = 'brief_read',
  HotTakeVote = 'hot_take_vote',
  HotTakeCreate = 'hot_take_create',
  UserFollow = 'user_follow',
  ViewUserProfile = 'view_user_profile',
  PostShare = 'post_share',
  VisitArena = 'visit_arena',
  VisitExplorePage = 'visit_explore_page',
  VisitDiscussionsPage = 'visit_discussions_page',
  VisitReadItLaterPage = 'visit_read_it_later_page',
  FeedbackSubmit = 'feedback_submit',
  SquadJoin = 'squad_join',
  FollowerGain = 'follower_gain',
  ReferralCount = 'referral_count',
  QuestComplete = 'quest_complete',
  UpvoteReceived = 'upvote_received',
  ExtensionInstall = 'extension_install',
  NotificationsEnable = 'notifications_enable',
  BriefGenerate = 'brief_generate',
  ProfileComplete = 'profile_complete',
}

export interface QuestCriteria {
  targetCount?: number;
  metadata?: Record<string, unknown>;
}

@Entity()
@Index('IDX_quest_type_active', ['type', 'active'])
export class Quest {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quest_id',
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
  @Index('IDX_quest_type_value')
  type: QuestType;

  @Column({ type: 'text' })
  @Index('IDX_quest_eventType_value')
  eventType: QuestEventType;

  @Column({ type: 'jsonb', default: {} })
  criteria: QuestCriteria;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
