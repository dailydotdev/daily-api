import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import {
  ExperienceAssociationType,
  ProjectLink,
  UserExperienceType,
} from './types';

@ChildEntity(UserExperienceType.Project)
export class UserProjectExperience extends UserExperience {
  @Column({ type: 'jsonb', default: () => "'[]'" })
  links: Array<ProjectLink>;

  // user ids
  @Column({ type: 'jsonb', default: () => "'[]'" })
  contributors: string[];

  // not adding a relationship, maybe is not important for now
  @Column({ type: 'jsonb', nullable: true })
  associatedWith: {
    type: ExperienceAssociationType;
    id: string;
  };
}
