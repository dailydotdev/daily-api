import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.OpenSource)
export class UserExperienceOpenSource extends UserExperience {
  @Column({ type: 'text', nullable: true })
  url: string | null;
}
