import { UserExperience } from './UserExperience';
import { ChildEntity, Column } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Certification)
export class UserExperienceCertification extends UserExperience {
  @Column({ type: 'text', nullable: true })
  externalReferenceId: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;
}
