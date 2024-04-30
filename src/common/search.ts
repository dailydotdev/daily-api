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
  if (limit > maxSearchLimit) {
    return maxSearchLimit;
  }

  if (limit < 1) {
    return 1;
  }

  return limit ?? defaultSearchLimit;
};
