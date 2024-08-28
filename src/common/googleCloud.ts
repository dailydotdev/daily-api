import { Storage, DownloadOptions } from '@google-cloud/storage';
import { PropsParameters } from '../types';

export enum StorageBucket {
  CodeSnippets = 'daily-dev-yggdrasil-code-snippets',
}

export const downloadFile = async ({
  bucket,
  fileName,
  options,
}: {
  bucket: StorageBucket;
  fileName: string;
  options?: DownloadOptions;
}): Promise<string> => {
  const storage = new Storage();

  const [result] = await storage
    .bucket(bucket)
    .file(fileName)
    .download(options);

  return result.toString();
};

export const downloadJsonFile = async <T>({
  bucket,
  fileName,
}: PropsParameters<typeof downloadFile>): Promise<T> => {
  const result = await downloadFile({ bucket, fileName });

  return JSON.parse(result);
};
