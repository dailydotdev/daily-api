import { DataSource, Entity, EntityManager, PrimaryColumn } from 'typeorm';

@Entity()
export class DisallowHandle {
  @PrimaryColumn({ unique: true })
  value: string;
}

export const checkDisallowHandle = async (
  entityManager: EntityManager | DataSource,
  value: string,
): Promise<boolean> => {
  const handle = await entityManager
    .getRepository(DisallowHandle)
    .createQueryBuilder()
    .select('value')
    .where('value = :value', {
      value: value?.toLowerCase(),
    })
    .getRawOne();
  return !!handle;
};
