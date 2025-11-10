import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Volunteering)
export class UserExperienceVolunteering extends UserExperience {
  @Column({ type: 'text', nullable: true })
  url: string | null;
}
