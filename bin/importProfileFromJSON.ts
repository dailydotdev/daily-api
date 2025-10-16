import '../src/config';

import { parseArgs } from 'node:util';
import { z } from 'zod';
import createOrGetConnection from '../src/db';
import { type DataSource, type EntityManager } from 'typeorm';
import { readFile } from 'node:fs/promises';
import {
  userExperienceInputBaseSchema,
  userExperienceWorkImportSchema,
} from '../src/common/schema/profile';
import { UserExperience } from '../src/entity/user/experiences/UserExperience';
import { Company } from '../src/entity/Company';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import { UserExperienceWork } from '../src/entity/user/experiences/UserExperienceWork';
import { insertOrIgnoreUserExperienceSkills } from '../src/entity/user/experiences/UserExperienceSkill';
import { textFromEnumValue } from '../src/common';
import { LocationType } from '@dailydotdev/schema';
import { DatasetLocation } from '../src/entity/dataset/DatasetLocation';

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

const importUserExperienceWork = async ({
  data,
  con,
  userId,
}: {
  data: unknown;
  con: EntityManager;
  userId: string;
}) => {
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
};

const main = async () => {
  let con: DataSource | null = null;

  try {
    const { values } = parseArgs({
      options: {
        path: {
          type: 'string',
          short: 'p',
        },
        userId: {
          type: 'string',
          short: 'u',
        },
      },
    });

    const paramsSchema = z.object({
      path: z.string().nonempty(),
      userId: z.string().nonempty(),
    });

    const params = paramsSchema.parse(values);

    con = await createOrGetConnection();

    const dataJSON = JSON.parse(await readFile(params.path, 'utf-8'));

    const data = z
      .array(
        userExperienceInputBaseSchema
          .pick({
            type: true,
          })
          .loose(),
      )
      .parse(dataJSON);

    await con.transaction(async (entityManager) => {
      for (const item of data) {
        switch (item.type) {
          case UserExperienceType.Work:
            await importUserExperienceWork({
              data: item,
              con: entityManager,
              userId: params.userId,
            });
            break;
          default:
            throw new Error(`Unsupported experience type: ${item.type}`);
        }

        break;
      }
    });
  } catch (error) {
    console.error(error instanceof z.ZodError ? z.prettifyError(error) : error);
  } finally {
    if (con) {
      con.destroy();
    }

    process.exit(0);
  }
};

main();
