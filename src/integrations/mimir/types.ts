// Keep the type flexible to allow for future changes
import { SearchRequest, SearchResponse } from '@dailydotdev/schema';

export interface IMimirClient {
  search({
    query,
    version,
    offset,
    limit,
  }: SearchRequest): Promise<SearchResponse>;
}
