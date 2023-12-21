import { readFileSync } from 'fs';
import createOrGetConnection from '../src/db';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { TagRecommendation } from '../src/entity/TagRecommendation';

const getConflictPaths = (repository: Repository<ObjectLiteral>) => {
  // Get primary key columns
  const primaryKeyColumns = repository.metadata.columns
    .filter((column) => column.isPrimary)
    .map((column) => column.propertyName);
  // Get unique constraint columns
  const uniqueConstraintColumns = repository.metadata.uniques.flatMap(
    (constraint) => constraint.columns.map((c) => c.propertyName),
  );

  // make sure we do not have duplicates in the list
  const paths = new Set([
    ...primaryKeyColumns,
    ...uniqueConstraintColumns,
  ]).keys();
  return [...paths];
};

const importEntity = async (
  con: DataSource,
  name: string,
  isUpsert = false,
): Promise<void> => {
  const opName = isUpsert ? 'upsert' : 'insert';
  console.log(`${opName}ing ${name}`);
  const entities = JSON.parse(readFileSync(`./seeds/${name}.json`).toString());
  const repository = con.getRepository(name);
  const conflictPaths = isUpsert && getConflictPaths(repository);

  const write = async (data) => {
    if (isUpsert) {
      await repository.upsert(data, {
        conflictPaths,
        skipUpdateIfNoValuesChanged: true,
      });
    } else {
      await repository.insert(data);
    }
  };

  // Batch insert with dirty hack
  for (let i = 0; i < entities.length; i += 1000) {
    await write(entities.slice(i, i + 1000));
  }
};

const isUpsert = process.argv.includes('--upsert');

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();
  await importEntity(con, 'AdvancedSettings', isUpsert);
  await importEntity(con, 'Source', isUpsert);
  await importEntity(con, 'Post', isUpsert);
  await importEntity(con, 'YouTubePost', isUpsert);
  await importEntity(con, 'Category', isUpsert);
  await importEntity(con, 'PostKeyword', isUpsert);
  await importEntity(con, 'User', isUpsert);
  // Manually have to reset these as insert has a issue with `type` columns
  await con.query(`update post set type = 'article' where type = 'Post'`);
  await con.query(`update source set type = 'machine' where type = 'Source'`);
  await con.query(
    `REFRESH MATERIALIZED VIEW ${
      con.getRepository(TagRecommendation).metadata.tableName
    }`,
  );
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
