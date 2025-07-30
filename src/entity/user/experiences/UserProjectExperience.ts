import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import {
  ExperienceAssociationType,
  ProjectLink,
  UserExperienceType,
} from './types';

@ChildEntity(UserExperienceType.Project)
export class UserProjectExperience extends UserExperience {
  @Column({ type: 'text', array: true, default: [] })
  links: Array<ProjectLink>;

  // user ids
  @Column({ type: 'text', array: true, default: [] })
  contributors: string[];

  // not adding a relationship, maybe is not important for now
  @Column({ type: 'jsonb', nullable: true })
  associatedWith: {
    type: ExperienceAssociationType;
    id: string;
  };
}
