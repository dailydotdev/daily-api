// Keep the type flexible to allow for future changes
import { SearchRequest, SearchResponse } from '@dailydotdev/schema';

export interface IMimirClient {
  search({
    query,
    version,
    offset = 0,
    limit = 10,
  }: SearchRequest): Promise<SearchResponse>;
}
