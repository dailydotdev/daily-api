import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { UserExperience } from './UserExperience';
import { Company } from '../../Company';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Education)
export class UserEducationExperience extends UserExperience {
  @Column()
  schoolId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'schoolId' })
  school: Promise<Company>;

  // autocomplete
  @Column({ type: 'text' })
  fieldOfStudy: string;

  // Need to define if this will be an ENUM using some kind of convention
  @Column({ type: 'text', nullable: true })
  grade: string;

  @Column({ type: 'text', nullable: true })
  extracurriculars: string;
}
