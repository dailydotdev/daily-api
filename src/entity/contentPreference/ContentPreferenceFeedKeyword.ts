import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { Keyword } from '../Keyword';
import type { Feed } from '../Feed';

@ChildEntity(ContentPreferenceType.Keyword)
export class ContentPreferenceFeedKeyword extends ContentPreference {
  @Column({ type: 'text', default: null })
  keywordId: string;

  @Column({ type: 'text', default: null })
  feedId: string;

  @ManyToOne('Keyword', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keywordId' })
  keyword: Promise<Keyword>;

  @ManyToOne('Feed', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedId' })
  feed: Promise<Feed>;
}
