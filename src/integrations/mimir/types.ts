// Keep the type flexible to allow for future changes
export type MimirResponse = Partial<{
  type: string;
}>;

export interface IMimirClient {
  search({
    query,
    version,
    offset = 0,
    limit = 10,
  }: {
    query: string;
    version: number;
    offset: number;
    limit: number;
  }): Promise<MimirResponse>;
}
