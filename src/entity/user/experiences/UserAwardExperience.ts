import { ChildEntity, Column } from 'typeorm';
import { ExperienceAssociationType, UserExperienceType } from './types';
import { UserExperience } from './UserExperience';

@ChildEntity(UserExperienceType.Award)
export class UserAwardExperience extends UserExperience {
  // autocomplete
  @Column({ type: 'text', nullable: true })
  issuer: string;

  // not adding a relationship, maybe is not important for now
  @Column({ type: 'jsonb', nullable: true })
  associatedWith: {
    type: ExperienceAssociationType;
    id: string;
  };
}
