import { type EntityManager } from 'typeorm';
import {
  userExperienceCertificationImportSchema,
  userExperienceEducationImportSchema,
  userExperienceProjectImportSchema,
  userExperienceWorkImportSchema,
} from '../../../src/common/schema/profile';
import { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { Company } from '../../../src/entity/Company';
import { UserExperienceWork } from '../../../src/entity/user/experiences/UserExperienceWork';
import { insertOrIgnoreUserExperienceSkills } from '../../../src/entity/user/experiences/UserExperienceSkill';
import { textFromEnumValue } from '../../../src/common';
import { LocationType } from '@dailydotdev/schema';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import { UserExperienceEducation } from '../../../src/entity/user/experiences/UserExperienceEducation';
import { UserExperienceCertification } from '../../../src/entity/user/experiences/UserExperienceCertification';
import { UserExperienceProject } from '../../../src/entity/user/experiences/UserExperienceProject';

const resolveUserCompanyPart = async ({
  name,
  con,
  threshold = 0.5,
}: {
  name?: string | null;
  con: EntityManager;
  threshold?: number;
}): Promise<
  Partial<Pick<UserExperience, 'customCompanyName' | 'companyId'>>
> => {
  if (!name) {
    return {};
  }

  const company = await con
    .getRepository(Company)
    .createQueryBuilder()
    .addSelect('id')
    .addSelect(`similarity(name, '${name}')`, 'similarity')
    .orderBy('similarity', 'DESC')
    .getRawOne<Pick<Company, 'id'> & { similarity: number }>();

  if (company && company.similarity > threshold) {
    return {
      companyId: company.id,
    };
  }

  return {
    customCompanyName: name,
  };
};

const resolveUserLocationPart = async ({
  location,
  con,
  threshold = 0.5,
}: {
  location?: Partial<Pick<DatasetLocation, 'country' | 'subdivision' | 'city'>>;
  con: EntityManager;
  threshold?: number;
}): Promise<Partial<Pick<UserExperience, 'locationId'>>> => {
  if (!location) {
    return {};
  }

  const datasetLocationQb = await con
    .getRepository(DatasetLocation)
    .createQueryBuilder()
    .addSelect('id');

  if (location.city) {
    datasetLocationQb.addSelect(
      `coalesce(similarity(city, '${location.city}'), 0)`,
      'similarityCity',
    );
    datasetLocationQb.addOrderBy('"similarityCity"', 'DESC');
  }

  if (location.subdivision) {
    datasetLocationQb.addSelect(
      `coalesce(similarity(subdivision, '${location.subdivision}'), 0)`,
      'similaritySubdivision',
    );
    datasetLocationQb.addOrderBy('"similaritySubdivision"', 'DESC');
  }

  if (location.country) {
    datasetLocationQb.addSelect(
      `coalesce(similarity(country, '${location.country}'), 0)`,
      'similarityCountry',
    );
    datasetLocationQb.addOrderBy('"similarityCountry"', 'DESC');
  }

  const datasetLocation = await datasetLocationQb.getRawOne<
    Pick<DatasetLocation, 'id'> & {
      similarityCountry: number;
      similaritySubdivision: number;
      similarityCity: number;
    }
  >();

  if (
    datasetLocation &&
    (datasetLocation.similarityCountry > threshold ||
      datasetLocation.similaritySubdivision > threshold ||
      datasetLocation.similarityCity > threshold)
  ) {
    return {
      locationId: datasetLocation.id,
    };
  }

  return {};
};

export const importUserExperienceWork = async ({
  data,
  con,
  userId,
}: {
  data: unknown;
  con: EntityManager;
  userId: string;
}): Promise<{ experienceId: string }> => {
  const userExperience = userExperienceWorkImportSchema.parse(data);

  const {
    company,
    title,
    description,
    started_at: startedAt,
    location_type: locationType,
    skills,
    ended_at: endedAt,
    location,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceWork).insert(
    con.getRepository(UserExperienceWork).create({
      userId: userId,
      ...(await resolveUserCompanyPart({
        name: company,
        con: con,
      })),
      title,
      description,
      startedAt,
      endedAt,
      locationType: locationType
        ? (Object.entries(LocationType).find(([, value]) => {
            return (
              // TODO cv-parsing remove this replace when cv is adjusted to not use prefix
              locationType.replace('LOCATION_TYPE_', '') ===
              textFromEnumValue(LocationType, value)
            );
          })?.[1] as LocationType)
        : undefined,
      ...(await resolveUserLocationPart({
        location,
        con: con,
      })),
    }),
  );

  const experienceId = insertResult.identifiers[0].id;

  if (skills) {
    await insertOrIgnoreUserExperienceSkills(con, experienceId, skills);
  }

  return {
    experienceId,
  };
};

export const importUserExperienceEducation = async ({
  data,
  con,
  userId,
}: {
  data: unknown;
  con: EntityManager;
  userId: string;
}): Promise<{ experienceId: string }> => {
  const userExperience = userExperienceEducationImportSchema.parse(data);

  // TODO cv-parsing potentially won't be needed once cv is adjusted to use camelCase
  const {
    company,
    title,
    description,
    started_at: startedAt,
    skills,
    ended_at: endedAt,
    location,
    subtitle,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceEducation).insert(
    con.getRepository(UserExperienceEducation).create({
      userId: userId,
      ...(await resolveUserCompanyPart({
        name: company,
        con: con,
      })),
      title,
      description,
      startedAt,
      endedAt,
      ...(await resolveUserLocationPart({
        location,
        con: con,
      })),
      subtitle,
    }),
  );

  const experienceId = insertResult.identifiers[0].id;

  if (skills) {
    await insertOrIgnoreUserExperienceSkills(con, experienceId, skills);
  }

  return {
    experienceId,
  };
};

export const importUserExperienceCertification = async ({
  data,
  con,
  userId,
}: {
  data: unknown;
  con: EntityManager;
  userId: string;
}): Promise<{ experienceId: string }> => {
  const userExperience = userExperienceCertificationImportSchema.parse(data);

  const {
    company,
    title,
    started_at: startedAt,
    ended_at: endedAt,
  } = userExperience;

  const insertResult = await con
    .getRepository(UserExperienceCertification)
    .insert(
      con.getRepository(UserExperienceCertification).create({
        userId: userId,
        ...(await resolveUserCompanyPart({
          name: company,
          con: con,
        })),
        title,
        startedAt,
        endedAt,
      }),
    );

  const experienceId = insertResult.identifiers[0].id;

  return {
    experienceId,
  };
};

export const importUserExperienceProject = async ({
  data,
  con,
  userId,
}: {
  data: unknown;
  con: EntityManager;
  userId: string;
}): Promise<{ experienceId: string }> => {
  const userExperience = userExperienceProjectImportSchema.parse(data);

  const {
    title,
    description,
    started_at: startedAt,
    ended_at: endedAt,
    skills,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceProject).insert(
    con.getRepository(UserExperienceProject).create({
      userId: userId,
      title,
      description,
      startedAt,
      endedAt,
    }),
  );

  const experienceId = insertResult.identifiers[0].id;

  if (skills) {
    await insertOrIgnoreUserExperienceSkills(con, experienceId, skills);
  }

  return {
    experienceId,
  };
};
