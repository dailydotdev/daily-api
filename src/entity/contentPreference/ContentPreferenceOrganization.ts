import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';
import type { Organization } from '../Organization';
import type { OrganizationMemberRoles } from '../../roles';

export type ContentPreferenceOrganizationFlags = Partial<{
  role: OrganizationMemberRoles;
  referralToken: string;
}>;

@ChildEntity(ContentPreferenceType.Organization)
export class ContentPreferenceOrganization extends ContentPreference {
  @Column({ type: 'text', default: null })
  @Index('IDX_content_preference_organization_id')
  organizationId: string;

  @ManyToOne('Organization', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organizationId',
    foreignKeyConstraintName: 'FK_content_preference_organization_id',
  })
  organization: Promise<Organization>;

  @Column({ type: 'jsonb', default: {} })
  flags: ContentPreferenceOrganizationFlags;
}
