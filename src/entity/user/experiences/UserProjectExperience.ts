import { UserExperience } from './UserExperience';
import { ChildEntity, Column, JoinColumn, OneToOne } from 'typeorm';
import { ProjectLink, UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Project)
export class UserProjectExperience extends UserExperience {
  @Column({ type: 'jsonb', default: [] })
  links: Array<ProjectLink>;

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
