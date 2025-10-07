import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Project)
export class UserExperienceProject extends UserExperience {
  @Column({ type: 'text', nullable: true })
  url: string | null;
}
