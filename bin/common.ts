import fastq from 'fastq';
import { ReadStream } from 'fs';

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
    stream.on('end', resolve);
  });
  await insertQueue.drained();
  console.log('update finished with a total of: ', insertCount);
};
