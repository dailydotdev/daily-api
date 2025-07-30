import { UserExperienceType } from './types';
import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import { UserExperience } from './UserExperience';

@ChildEntity(UserExperienceType.Publication)
export class UserPublicationExperience extends UserExperience {
  // autocomplete
  @Column({ type: 'text', nullable: true })
  publisher: string;

  // must be valid URL
  @Column({ type: 'text', nullable: true })
  url: string;

  // user ids
  @Column({ type: 'text', array: true, default: [] })
  contributors: string[];

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
