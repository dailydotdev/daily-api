import { readFileSync } from 'fs';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import { TagRecommendation } from '../src/entity/TagRecommendation';

const importEntity = async (
  con: DataSource,
  name: string,
  throwOnError = true,
): Promise<void> => {
  console.log(`importing ${name}`);
  const entities = JSON.parse(readFileSync(`./seeds/${name}.json`).toString());
  const repository = con.getRepository(name);

  // Batch insert with dirty hack
  for (let i = 0; i < entities.length; i += 1000) {
    await repository.insert(entities.slice(i, i + 1000)).catch((err) => {
      if (throwOnError) {
        throw err;
      } else {
        // Swallow the error if we're ignoring them
        // this will allow the next importEntity call to run
        console.error(err);
      }
    });
  }
};

const throwOnError = !process.argv.includes('--ignore-insert-errors');

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();
  await importEntity(con, 'AdvancedSettings', throwOnError);
  await importEntity(con, 'Source', throwOnError);
  await importEntity(con, 'Post', throwOnError);
  await importEntity(con, 'YouTubePost', throwOnError);
  await importEntity(con, 'Category', throwOnError);
  await importEntity(con, 'PostKeyword', throwOnError);
  await importEntity(con, 'User', throwOnError);
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
