import { getLimit } from './pagination';

export type SearchSuggestionArgs = {
  query: string;
  version: number;
  limit?: number;
};

export const defaultSearchLimit = 3;
export const maxSearchLimit = 100;

export const getSearchLimit = ({
  limit,
}: Pick<SearchSuggestionArgs, 'limit'>) => {
  return getLimit({
    limit: limit ?? defaultSearchLimit,
    defaultLimit: defaultSearchLimit,
    max: maxSearchLimit,
  });
};
