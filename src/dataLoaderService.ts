import DataLoader, { BatchLoadFn } from 'dataloader';
import { Context } from './Context';
import { getShortUrl } from './common';

export class DataLoaderService {
  protected loaders: Record<string, DataLoader<unknown, unknown>>;
  private ctx: Context;

  constructor({ ctx }: { ctx: Context }) {
    this.loaders = {};
    this.ctx = ctx;
  }

  protected getLoader<K, V>({
    type,
    loadFn,
  }: {
    type: string;
    loadFn: (params: K) => Promise<V> | V;
  }): DataLoader<K, V> {
    if (!this.loaders[type]) {
      const batchLoadFn: BatchLoadFn<K, V> = async (keys) => {
        const results = await Promise.allSettled(keys.map(loadFn));

        return results.map((result) => {
          if (result.status === 'rejected') {
            return result.reason;
          }

          return result.value;
        });
      };

      this.loaders[type] = new DataLoader(batchLoadFn, {
        cacheKeyFn: (key: K) => {
          if (typeof key === 'object') {
            return JSON.stringify(key);
          }

          return key.toString();
        },
        maxBatchSize: 30,
        name: `${DataLoaderService.name}.${type}`,
      });
    }

    return this.loaders[type] as DataLoader<K, V>;
  }

  get shortUrl() {
    return this.getLoader<string, string>({
      type: 'shortUrl',
      loadFn: (url) => getShortUrl(url, this.ctx.log),
    });
  }
}
