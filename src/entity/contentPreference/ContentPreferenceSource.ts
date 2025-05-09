import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
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
  @Index('IDX_content_preference_source_id')
  sourceId: string;

  @Column({ type: 'jsonb', default: {} })
  flags: ContentPreferenceSourceFlags;

  @ManyToOne('Source', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceId' })
  source: Promise<Source>;
}
