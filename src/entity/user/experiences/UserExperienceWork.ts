import { ChildEntity, Column } from 'typeorm';
import { UserExperience } from './UserExperience';
import { UserExperienceType } from './types';
import { EmploymentType } from '@dailydotdev/schema';

@ChildEntity(UserExperienceType.Work)
export class UserExperienceWork extends UserExperience {
  @Column({
    type: 'integer',
    comment: 'EmploymentType from protobuf schema',
    default: null,
  })
  employmentType: EmploymentType | null;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'jsonb', default: [] })
  skills: string[];
}
