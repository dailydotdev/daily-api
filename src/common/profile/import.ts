import { type EntityManager } from 'typeorm';
import {
  userExperienceCertificationImportSchema,
  userExperienceEducationImportSchema,
  userExperienceInputBaseSchema,
  userExperienceProjectImportSchema,
  userExperienceWorkImportSchema,
} from '../../../src/common/schema/profile';
import { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { Company } from '../../../src/entity/Company';
import { UserExperienceWork } from '../../../src/entity/user/experiences/UserExperienceWork';
import { insertOrIgnoreUserExperienceSkills } from '../../../src/entity/user/experiences/UserExperienceSkill';
import { textFromEnumValue } from '../../../src/common';
import { EmploymentType, LocationType } from '@dailydotdev/schema';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import { UserExperienceEducation } from '../../../src/entity/user/experiences/UserExperienceEducation';
import { UserExperienceCertification } from '../../../src/entity/user/experiences/UserExperienceCertification';
import { UserExperienceProject } from '../../../src/entity/user/experiences/UserExperienceProject';
import z from 'zod';
import { UserExperienceType } from '../../entity/user/experiences/types';

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
    .setParameter('companyName', name)
    .addSelect('id')
    .addSelect(`similarity(name, :companyName)`, 'similarity')
    .orderBy('similarity', 'DESC')
    .limit(1)
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
  location?: {
    city?: string | null;
    subdivision?: string | null;
    country?: string | null;
  } | null;
  con: EntityManager;
  threshold?: number;
}): Promise<Partial<Pick<UserExperience, 'locationId' | 'customLocation'>>> => {
  if (!location) {
    return {};
  }

  const datasetLocationQb = await con
    .getRepository(DatasetLocation)
    .createQueryBuilder()
    .addSelect('id');

  if (location.city) {
    datasetLocationQb
      .setParameter('locationCity', location.city)
      .addSelect(
        `coalesce(similarity(city, :locationCity), 0)`,
        'similarityCity',
      );
    datasetLocationQb.addOrderBy('"similarityCity"', 'DESC');
  }

  if (location.subdivision) {
    datasetLocationQb
      .setParameter('locationSubdivision', location.subdivision)
      .addSelect(
        `coalesce(similarity(subdivision, :locationSubdivision), 0)`,
        'similaritySubdivision',
      );
    datasetLocationQb.addOrderBy('"similaritySubdivision"', 'DESC');
  }

  if (location.country) {
    datasetLocationQb
      .setParameter('locationCountry', location.country)
      .addSelect(
        `coalesce(similarity(country, :locationCountry), 0)`,
        'similarityCountry',
      );
    datasetLocationQb.addOrderBy('"similarityCountry"', 'DESC');
  }

  const datasetLocation = await datasetLocationQb.limit(1).getRawOne<
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

  return {
    customLocation: location,
  };
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
  const userExperience = await userExperienceWorkImportSchema.parseAsync(data);

  const {
    company,
    title,
    description,
    started_at: startedAt,
    location_type: locationType,
    skills,
    ended_at: endedAt,
    location,
    flags,
    employment_type: employmentType,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceWork).insert(
    con.getRepository(UserExperienceWork).create({
      flags,
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
              locationType.replace('LOCATION_TYPE_', '') ===
              textFromEnumValue(LocationType, value)
            );
          })?.[1] as LocationType)
        : undefined,
      ...(await resolveUserLocationPart({
        location,
        con: con,
      })),
      employmentType: employmentType
        ? (Object.entries(EmploymentType).find(([, value]) => {
            return (
              employmentType.replace('EMPLOYMENT_TYPE_', '') ===
              textFromEnumValue(EmploymentType, value)
            );
          })?.[1] as EmploymentType)
        : undefined,
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
  const userExperience =
    await userExperienceEducationImportSchema.parseAsync(data);

  const {
    company,
    title,
    description,
    started_at: startedAt,
    skills,
    ended_at: endedAt,
    location,
    subtitle,
    flags,
    grade,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceEducation).insert(
    con.getRepository(UserExperienceEducation).create({
      flags,
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
      grade,
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
  const userExperience =
    await userExperienceCertificationImportSchema.parseAsync(data);

  const {
    company,
    title,
    started_at: startedAt,
    ended_at: endedAt,
    flags,
    url,
  } = userExperience;

  const insertResult = await con
    .getRepository(UserExperienceCertification)
    .insert(
      con.getRepository(UserExperienceCertification).create({
        flags,
        userId: userId,
        ...(await resolveUserCompanyPart({
          name: company,
          con: con,
        })),
        title,
        startedAt,
        endedAt,
        url,
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
  const userExperience =
    await userExperienceProjectImportSchema.parseAsync(data);

  const {
    title,
    description,
    started_at: startedAt,
    ended_at: endedAt,
    skills,
    flags,
    url,
  } = userExperience;

  const insertResult = await con.getRepository(UserExperienceProject).insert(
    con.getRepository(UserExperienceProject).create({
      flags,
      userId: userId,
      title,
      description,
      startedAt,
      endedAt,
      url,
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

export const importUserExperienceFromJSON = async ({
  con,
  dataJson,
  userId,
  importId,
  transaction = false,
}: {
  con: EntityManager;
  dataJson: unknown;
  userId: string;
  importId?: string;
  transaction?: boolean;
}) => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const data = await z
    .preprocess(
      (item) => {
        if (item === null) {
          return [];
        }

        if (typeof item === 'object' && !Array.isArray(item)) {
          return [];
        }

        return item;
      },
      z.array(
        userExperienceInputBaseSchema
          .pick({
            type: true,
          })
          .loose(),
      ),
    )
    .parseAsync(dataJson);

  const transactionFn = async <T>(
    callback: (entityManager: EntityManager) => Promise<T>,
  ) => {
    return transaction ? con.transaction(callback) : callback(con);
  };

  await transactionFn(async (entityManager) => {
    for (const item of data) {
      const importData = {
        ...item,
        flags: importId ? { import: importId } : undefined,
      };

      switch (importData.type) {
        case UserExperienceType.Work:
          await importUserExperienceWork({
            data: importData,
            con: entityManager,
            userId,
          });

          break;
        case UserExperienceType.Education:
          await importUserExperienceEducation({
            data: importData,
            con: entityManager,
            userId,
          });

          break;
        case UserExperienceType.Certification:
          await importUserExperienceCertification({
            data: importData,
            con: entityManager,
            userId,
          });

          break;
        case UserExperienceType.Project:
        case UserExperienceType.OpenSource:
        case UserExperienceType.Volunteering:
          await importUserExperienceProject({
            data: importData,
            con: entityManager,
            userId,
          });

          break;
        default:
          throw new Error(`Unsupported experience type: ${importData.type}`);
      }
    }
  });
};
