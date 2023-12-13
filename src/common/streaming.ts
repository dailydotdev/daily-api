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
