import { writeFileSync } from 'fs';
import createOrGetConnection from '../src/db';

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();
  for (const entity of con.entityMetadatas) {
    console.log(`exporting ${entity.name}`);
    const repository = await con.getRepository(entity.name);
    const entities = await repository.find();
    writeFileSync(`./seeds/${entity.name}.json`, JSON.stringify(entities));
  }
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
