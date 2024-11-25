import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { User } from '../user/User';

@ChildEntity(ContentPreferenceType.User)
export class ContentPreferenceUser extends ContentPreference {
  @Column({ type: 'text', default: null })
  @Index('IDX_content_preference_reference_user_id')
  referenceUserId: string;

  @Column({ type: 'text', default: null })
  feedId: string;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenceUserId' })
  referenceUser: Promise<User>;
}
