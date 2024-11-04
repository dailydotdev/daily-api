import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { Feed } from '../Feed';
import type { Source } from 'graphql';
import { SourceMemberRoles } from '../../roles';
import type { SourceMemberFlags } from '../SourceMember';

export type ContentPreferenceSourceFlags = Partial<{
  role: SourceMemberRoles;
  referralToken: string;
}> &
  SourceMemberFlags;

@ChildEntity(ContentPreferenceType.Source)
export class ContentPreferenceSource extends ContentPreference {
  @Column({ type: 'text', default: null })
  sourceId: string;

  @Column({ type: 'text', default: null })
  feedId: string;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_content_preference_flags_referralToken', { synchronize: false })
  flags: ContentPreferenceSourceFlags;

  @ManyToOne('Source', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceId' })
  source: Promise<Source>;

  @ManyToOne('Feed', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedId' })
  feed: Promise<Feed>;
}
