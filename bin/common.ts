import fastq from 'fastq';
import { ReadStream } from 'fs';
import {
  parseArgs,
  type ParseArgsConfig,
  type ParseArgsOptionsConfig,
} from 'util';
import z from 'zod';
import { isNullOrUndefined } from '../src/common/object';

const QUEUE_CONCURRENCY = 1;

export const runInQueueStream = async <T>(
  stream: ReadStream,
  callback: (props: T) => Promise<void>,
  queue = QUEUE_CONCURRENCY,
) => {
  let insertCount = 0;
  const insertQueue = fastq.promise(async (props: T) => {
    await callback(props);

    insertCount += 1;
  }, queue);

  stream.on('data', insertQueue.push);

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', () => resolve(true));
  });
  await insertQueue.drained();
  console.log('update finished with a total of: ', insertCount);
};

type AllowedZodTypes = z.ZodString | z.ZodBoolean;

export const zodToParseArgs = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  config: Omit<ParseArgsConfig, 'options'> = {},
): z.infer<typeof schema> => {
  const options = Object.keys(schema.shape).reduce((acc, key) => {
    const field = schema.shape[key] as AllowedZodTypes;

    if (field instanceof z.ZodBoolean) {
      acc[key] = { type: 'boolean' };
    } else {
      acc[key] = { type: 'string' };
    }

    const meta = field.meta() as { short?: string };

    if (meta?.short) {
      acc[key].short = meta.short;
    }

    const defaultValue = field.safeParse(undefined).data;

    if (!isNullOrUndefined(defaultValue)) {
      acc[key].default = defaultValue.toString();
    }

    return acc;
  }, {} as ParseArgsOptionsConfig);

  const { values } = parseArgs({ ...config, options });

  return schema.parse(values);
};
