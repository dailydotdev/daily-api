import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import type { Company } from '../../Company';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Education)
export class UserEducationExperience extends UserExperience {
  @Column()
  schoolId: string;

  @ManyToOne('Company')
  @JoinColumn({ name: 'schoolId' })
  school: Promise<Company>;

  @Column({ type: 'text' })
  fieldOfStudy: string;

  // todo: Need to define if this is an ENUM using some kind of convention
  @Column({ type: 'text', nullable: true })
  grade: string;

  @Column({ type: 'text', nullable: true })
  extracurriculars: string;
}
