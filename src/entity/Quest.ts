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
  UserFollow = 'user_follow',
  PostShare = 'post_share',
  SquadJoin = 'squad_join',
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
