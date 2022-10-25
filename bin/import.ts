import { readFileSync } from 'fs';
import { Connection } from 'typeorm';
import { createOrGetConnection } from '../src/db';

enum Entity {
  AdvancedSettings = 'AdvancedSettings',
  Source = 'Source',
  Post = 'Post',
  Keyword = 'Keyword',
  Category = 'Category',
  PostKeyword = 'PostKeyword',
}

const importEntity = async (con: Connection, name: Entity): Promise<void> => {
  console.log(`importing ${name}`);
  const entities = JSON.parse(readFileSync(`./seeds/${name}.json`).toString());
  const repository = con.getRepository(name);
  // Batch insert with dirty hack
  for (let i = 0; i < entities.length; i += 1000) {
    if (name === Entity.Keyword) {
      await repository.save(entities.slice(i, i + 1000));
    } else {
      await repository.insert(entities.slice(i, i + 1000));
    }
  }
};

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();
  const entities = Object.values(Entity);
  entities.forEach(async (entity) => await importEntity(con, entity));
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
