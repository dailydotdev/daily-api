import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Course)
export class UserCourseExperience extends UserExperience {
  @Column({ type: 'text', nullable: true })
  courseNumber: string;

  // autocomplete
  @Column({ type: 'text', nullable: true })
  institution: string;
}
