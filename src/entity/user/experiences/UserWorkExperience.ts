import { ChildEntity, Column, OneToMany } from 'typeorm';
import { UserExperience } from './UserExperience';
import { UserExperienceType } from './types';
import { EmploymentType } from '@dailydotdev/schema';
import { listAllProtoEnumValues } from '../../../common';
import type { UserExperienceSkill } from './UserExperienceSkill';

const defaultEmploymentTypes = listAllProtoEnumValues(EmploymentType);

@ChildEntity(UserExperienceType.Work)
export class UserWorkExperience extends UserExperience {
  @Column({
    type: 'integer',
    array: true,
    comment: 'EmploymentType from protobuf schema',
    default: defaultEmploymentTypes,
  })
  employmentType: Array<EmploymentType> = defaultEmploymentTypes;

  @Column({ default: false })
  verified: boolean;

  @OneToMany(
    'UserExperienceSkill',
    (skill: UserExperienceSkill) => skill.experience,
    { lazy: true },
  )
  skills: Promise<UserExperienceSkill>;
}
