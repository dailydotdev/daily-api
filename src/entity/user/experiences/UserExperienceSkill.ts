import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import type { UserWorkExperience } from './UserWorkExperience';

@Entity()
export class UserExperienceSkill {
  @PrimaryColumn({ type: 'text' })
  slug: string;

  @Column({ type: 'text', unique: true })
  experienceId: string;

  @ManyToOne(
    'UserExperience',
    (experience: UserWorkExperience) => experience.skills,
    {
      lazy: true,
      onDelete: 'CASCADE',
    },
  )
  experience: Promise<UserWorkExperience>;
}
