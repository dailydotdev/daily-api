import { readFileSync, readdirSync } from 'fs';
import createOrGetConnection from '../src/db';
import type { DataSource } from 'typeorm';
import z from 'zod';
import { zodToParseArgs } from './common';
import { seedEntityNames } from './seedEntities';

type SeedEntity = Record<string, unknown>;

const getSeedFilePaths = (name: string): string[] => {
  const primaryFile = `${name}.json`;
  const additionalFiles = readdirSync('./seeds')
    .filter(
      (file) =>
        file !== primaryFile &&
        file.startsWith(`${name}.`) &&
        file.endsWith('.json'),
    )
    .sort();

  const fileNames = [primaryFile, ...additionalFiles].filter((file) => {
    try {
      readFileSync(`./seeds/${file}`);
      return true;
    } catch {
      return false;
    }
  });

  return fileNames.map((file) => `./seeds/${file}`);
};

const loadSeedEntities = (name: string): SeedEntity[] =>
  getSeedFilePaths(name).flatMap((path) =>
    JSON.parse(readFileSync(path, 'utf8').toString()),
  );

const getConflictPaths = (entityName: string): string[] | undefined => {
  switch (entityName) {
    case 'Keyword':
      return ['value'];
    case 'PostKeyword':
      return ['postId', 'keyword'];
    default:
      return undefined;
  }
};

const importEntity = async (
  con: DataSource,
  name: string,
  options: {
    conflictPaths?: string[];
  } = {},
): Promise<void> => {
  const repository = con.getRepository(name);
  const primaryColumns = repository.metadata.primaryColumns.map(
    (column) => column.propertyName,
  );
  const entities = loadSeedEntities(name);
  const dedupedEntities =
    primaryColumns.length > 0
      ? Array.from(
          new Map(
            entities.map((entity): [string, SeedEntity] => [
              primaryColumns
                .map((column) => String(entity[column] ?? ''))
                .join('::'),
              entity,
            ]),
          ).values(),
        )
      : entities;

  if (!dedupedEntities.length) {
    console.log(`skipping ${name}`);
    return;
  }

  console.log(`importing ${name} (${dedupedEntities.length})`);
  // Batch insert with dirty hack
  for (let i = 0; i < dedupedEntities.length; i += 1000) {
    if (options.conflictPaths) {
      await repository.upsert(
        dedupedEntities.slice(i, i + 1000),
        options.conflictPaths,
      );
    } else {
      await repository.insert(dedupedEntities.slice(i, i + 1000));
    }
  }
};

const viewsToRefresh = [
  'TagRecommendation',
  'SourceTagView',
  'TrendingPost',
  'TrendingSource',
  'TrendingTag',
  'PopularPost',
  'PopularSource',
  'PopularTag',
  'PopularVideoPost',
  'PopularVideoSource',
  'UserStats',
];

const paramsSchema = z.object({
  // if the user wants to run the script for a specific entity
  entity: z.string().optional().meta({ short: 'e' }),
});

const start = async (): Promise<void> => {
  const params = zodToParseArgs(paramsSchema);
  const con = await createOrGetConnection();

  if (params.entity) {
    console.log('importing specific entity for: ', params.entity);
    return await importEntity(con, params.entity, {
      conflictPaths: getConflictPaths(params.entity),
    });
  }

  for (const entityName of seedEntityNames) {
    await importEntity(con, entityName, {
      conflictPaths: getConflictPaths(entityName),
    });
  }
  // Manually have to reset these as insert has a issue with `type` columns
  await con.query(`update post set type = 'article' where type = 'Post'`);
  await con.query(`update source set type = 'machine' where type = 'Source'`);
  await con.query(`update source set type = 'squad' where id = 'publicsquad'`);
  // Fix UserExperience type column (TypeORM table inheritance issue)
  await con.query(
    `update user_experience set type = 'work' where type = 'UserExperience' and "employmentType" is not null`,
  );
  await con.query(
    `update user_experience set type = 'education' where type = 'UserExperience' and grade is not null`,
  );
  await con.query(
    `update user_experience set type = 'project' where type = 'UserExperience' and url is not null and "externalReferenceId" is null`,
  );
  await con.query(
    `update user_experience set type = 'certification' where type = 'UserExperience' and "externalReferenceId" is not null`,
  );
  await con.query(
    `update user_experience set type = 'opensource' where type = 'UserExperience' and url is not null and "externalReferenceId" is null and "customCompanyName" is null`,
  );
  await con.query(
    `update user_experience set type = 'volunteering' where type = 'UserExperience' and "employmentType" is null and grade is null and url is null and "externalReferenceId" is null`,
  );
  await con.transaction(async (manager) => {
    for (const viewToRefresh of viewsToRefresh) {
      await manager.query(
        `REFRESH MATERIALIZED VIEW ${con.getRepository(viewToRefresh).metadata.tableName}`,
      );
    }
  });
};

start()
  .then(() => {
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });
