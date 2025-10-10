import fs from 'fs';
import { parse } from 'csv-parse';
import createOrGetConnection from '../src/db';
import { DatasetLocation } from '../src/entity/dataset/DatasetLocation';
import z from 'zod';
import process from 'process';
import { zodToParseArgs } from './common';

interface LocationImport {
  city: string;
  country: string;
  iso2: string;
  iso3: string;
  subdivision: string;
  external_id: string;
  timezone: string;
  ranking: number;
}

const schema = z.object({
  // if the user wants to run the script for a specific entity
  csv: z.string().meta({ short: 'c' }),
  take: z.coerce.number().optional().default(100000).meta({ short: 't' }),
  start: z.coerce.number().optional().default(1).meta({ short: 's' }),
  batch: z.coerce.number().optional().default(1000).meta({ short: 'b' }),
});

const func = async () => {
  const { csv, batch, start, take } = zodToParseArgs(schema);

  if (!csv) {
    throw new Error('CSV file path is required');
  }

  const rows: LocationImport[] = [];

  const stream = fs.createReadStream(csv).pipe(
    parse({
      delimiter: ',',
      from_line: start,
      columns: true,
      to_line: start + take - 1,
    }),
  );

  stream.on('error', (err) => {
    console.error('failed to read file: ', err.message);
  });

  stream.on('data', function (location) {
    rows.push(location);
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
  });

  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    const repo = manager.getRepository(DatasetLocation);

    for (let i = 0; i < rows.length; i += batch) {
      repo
        .createQueryBuilder()
        .insert()
        .into(DatasetLocation)
        .values(
          rows.slice(i, i + batch).map(
            ({
              city,
              country,
              iso2,
              iso3,
              ranking,
              subdivision,
              timezone = 'UTC', // tmp for local dev (free dataset have this empty)
              external_id,
            }) =>
              repo.create({
                city,
                country,
                iso2,
                iso3,
                ranking,
                subdivision,
                timezone,
                externalId: external_id,
              }),
          ),
        )
        .orIgnore()
        .execute();
    }
  });

  process.exit(0);
};

func();
