import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { User } from '../user/User';

@ChildEntity(ContentPreferenceType.User)
export class ContentPreferenceUser extends ContentPreference {
  @Column({ type: 'text', default: null })
  referenceUserId: string;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenceUserId' })
  referenceUser: Promise<User>;
}
