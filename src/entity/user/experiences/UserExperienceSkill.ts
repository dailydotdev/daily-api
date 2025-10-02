import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { UserWorkExperience } from './UserWorkExperience';
import type { UserSkill } from '../UserSkill';

const compositePrimaryKeyName =
  'PK_COMPOSITE_user_experience_skill_slug_experienceId';

@Entity()
export class UserExperienceSkill {
  @ManyToOne('UserSkill', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'slug',
    foreignKeyConstraintName: 'FK_user_experience_skill_user_skill_slug',
  })
  skill: Promise<UserSkill>;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  slug: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  experienceId: string;

  @ManyToOne(
    'UserExperience',
    (experience: UserWorkExperience) => experience.skills,
    { lazy: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    foreignKeyConstraintName:
      'FK_user_experience_skill_user_experience_experienceId',
  })
  experience: Promise<UserWorkExperience>;
}
