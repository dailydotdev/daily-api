import { DataSource } from 'typeorm';
import { EntityTarget } from 'typeorm/common/EntityTarget';

export const isChanged = <T>(before: T, after: T, property: keyof T): boolean =>
  before[property] != after[property];

export const getTableName = <Entity>(
  con: DataSource,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;
