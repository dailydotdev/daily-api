import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { Organization } from '../Organization';
import type { OrganizationMemberRole } from '../../roles';

export enum ContentPreferenceOrganizationStatus {
  Free = 'free',
  Plus = 'plus',
}

export type ContentPreferenceOrganizationFlags = Partial<{
  role: OrganizationMemberRole;
  referralToken: string;
}>;

@ChildEntity(ContentPreferenceType.Organization)
export class ContentPreferenceOrganization extends ContentPreference<ContentPreferenceOrganizationStatus> {
  @Column({ type: 'uuid', default: null })
  @Index('IDX_content_preference_organization_id')
  organizationId: string;

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_content_preference_organization_id',
  })
  organization: Promise<Organization>;

  status: ContentPreferenceOrganizationStatus;

  @Column({ type: 'jsonb', default: {} })
  flags: ContentPreferenceOrganizationFlags;
}
