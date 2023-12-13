import { Readable } from 'stream';
import fastq from 'fastq';

export async function processStream<T>(
  stream: Readable,
  func: (x: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = fastq.promise(func, concurrency);
  stream.on('data', (row: T) => {
    queue.push(row);
  });
  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  await queue.drained();
}

export async function processStreamInBatches<T>(
  stream: Readable,
  func: (x: T[]) => Promise<void>,
  concurrency: number,
  batchSize: number,
): Promise<void> {
  let batch: T[] = [];
  const queue = fastq.promise(func, concurrency);
  stream.on('data', (row: T) => {
    batch.push(row);
    if (batch.length >= batchSize) {
      queue.push(batch);
      batch = [];
    }
  });
  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  if (batch.length > 0) {
    await queue.push(batch);
  }
  await queue.drained();
}
