import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { UserExperienceWork } from './UserExperienceWork';
import type { UserSkill } from '../UserSkill';

const compositePrimaryKeyName = 'PK_user_experience_skill_slug_experienceId';

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
    (experience: UserExperienceWork) => experience.skills,
    { lazy: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    foreignKeyConstraintName:
      'FK_user_experience_skill_user_experience_experienceId',
  })
  experience: Promise<UserExperienceWork>;
}
