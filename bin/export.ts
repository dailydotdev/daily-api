import { writeFileSync } from 'fs';
import createOrGetConnection from '../src/db';
import z from 'zod';
import { zodToParseArgs } from './common';
import type { DataSource } from 'typeorm';

const paramsSchema = z.object({
  // if the user wants to run the script for a specific entity
  entity: z.string().optional().meta({ short: 'e' }),
});

export const exportEntity = async (con: DataSource, name: string) => {
  console.log('exporting ', name);
  const repository = con.getRepository(name);
  const entities = await repository.find();
  writeFileSync(`./seeds/${name}.json`, JSON.stringify(entities));
};

const start = async (): Promise<void> => {
  const params = zodToParseArgs(paramsSchema);
  const con = await createOrGetConnection();

  if (params.entity) {
    return await exportEntity(con, params.entity);
  }

  for (const entity of con.entityMetadatas) {
    await exportEntity(con, entity.name);
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
