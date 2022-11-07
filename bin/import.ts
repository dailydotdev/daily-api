import { readFileSync } from 'fs';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';

const importEntity = async (con: DataSource, name: string): Promise<void> => {
  console.log(`importing ${name}`);
  const entities = JSON.parse(readFileSync(`./seeds/${name}.json`).toString());
  const repository = con.getRepository(name);
  // Batch insert with dirty hack
  for (let i = 0; i < entities.length; i += 1000) {
    await repository.insert(entities.slice(i, i + 1000));
  }
};

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();
  await importEntity(con, 'AdvancedSettings');
  await importEntity(con, 'Source');
  await importEntity(con, 'Post');
  await importEntity(con, 'Category');
  await importEntity(con, 'PostKeyword');
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
