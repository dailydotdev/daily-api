import { ChildEntity, Column, OneToMany } from 'typeorm';
import { UserExperience } from './UserExperience';
import { UserExperienceType } from './types';
import { EmploymentType } from '@dailydotdev/schema';
import type { UserExperienceSkill } from './UserExperienceSkill';

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

  @OneToMany(
    'UserExperienceSkill',
    (skill: UserExperienceSkill) => skill.experience,
    { lazy: true },
  )
  skills: Promise<UserExperienceSkill[]>;
}
