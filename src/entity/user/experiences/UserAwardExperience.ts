import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import { UserExperienceType } from './types';
import { UserExperience } from './UserExperience';

@ChildEntity(UserExperienceType.Award)
export class UserAwardExperience extends UserExperience {
  // autocomplete
  @Column({ type: 'text', nullable: true })
  issuer: string;

  @Column()
  workingExperienceId: string | null;

  @OneToOne('UserWorkExperience')
  @JoinColumn({
    name: 'workingExperienceId',
    referencedColumnName: 'id',
  })
  workingExperience: UserExperience | null;

  @Column()
  educationExperienceId: string | null;

  @OneToOne('UserEducationExperience')
  @JoinColumn({
    name: 'educationExperienceId',
    referencedColumnName: 'id',
  })
  educationExperience: UserExperience | null;
}
