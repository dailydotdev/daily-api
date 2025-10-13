import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { UserExperienceWork } from './UserExperienceWork';
import type { ConnectionManager } from '../../posts';
import { textToSlug } from '../../../common';

const compositePrimaryKeyName = 'PK_user_experience_value_experienceId';

@Entity()
export class UserExperienceSkill {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: compositePrimaryKeyName,
  })
  value: string;

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

export const insertOrIgnoreUserExperienceSkills = async (
  con: ConnectionManager,
  experienceId: string,
  skills: string[],
): Promise<void> => {
  if (!skills.length) {
    return;
  }

  // experience id and skill value is composite primary key, if duplicates are found, it won't be inserted
  await con
    .getRepository(UserExperienceSkill)
    .createQueryBuilder()
    .insert()
    .values(
      skills.map((value) => ({
        value,
        experienceId,
      })),
    )
    .orIgnore()
    .execute();
};

export const getNonExistingSkills = async (
  con: ConnectionManager,
  experienceId: string,
  skills: string[],
): Promise<string[]> => {
  if (!skills.length) {
    return [];
  }

  const slugified = skills.map(textToSlug);
  const existing = await con
    .getRepository(UserExperienceSkill)
    .createQueryBuilder('ues')
    .select('DISTINCT ues.value', 'value')
    .where('ues."experienceId" = :experienceId', {
      experienceId,
    })
    .andWhere('slugify(ues.value) = ANY(:skills)', { skills: slugified })
    .getRawMany<{ value: string }>();

  return skills.filter(
    (skill) =>
      !existing.find(({ value }) => textToSlug(value) === textToSlug(skill)),
  );
};

export const dropSkillsExcept = async (
  con: ConnectionManager,
  experienceId: string,
  skills: string[],
) => {
  const qb = con
    .getRepository(UserExperienceSkill)
    .createQueryBuilder()
    .delete()
    .where('experienceId = :experienceId', { experienceId });

  if (!skills.length) {
    return await qb.execute();
  }

  return await qb
    .andWhere(`slugify(value) NOT IN (:...skills)`, { skills })
    .execute();
};
