import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { Keyword } from '../Keyword';

@ChildEntity(ContentPreferenceType.Keyword)
export class ContentPreferenceKeyword extends ContentPreference {
  @Column({ type: 'text', default: null })
  keywordId: string;

  @ManyToOne('Keyword', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keywordId' })
  keyword: Promise<Keyword>;
}
