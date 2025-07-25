import { ExperienceAssociationType, UserExperienceType } from './types';
import { ChildEntity, Column } from 'typeorm';
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
  @Column({ type: 'simple-array', default: [] })
  contributors: string[];

  // not adding a relationship, maybe is not important for now
  @Column({ type: 'jsonb', nullable: true })
  associatedWith: {
    type: ExperienceAssociationType;
    id: string;
  };
}
