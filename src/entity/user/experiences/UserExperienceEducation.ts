import { ChildEntity, Column } from 'typeorm';
import { UserExperience } from './UserExperience';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Education)
export class UserExperienceEducation extends UserExperience {
  @Column({ type: 'text', nullable: true })
  grade: string | null;
}
