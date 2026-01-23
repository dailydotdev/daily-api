import type { DataSource } from 'typeorm';
import { DatasetGear } from '../entity/dataset/DatasetGear';

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\./g, 'dot')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/\s+/g, '');

export const findOrCreateDatasetGear = async (
  con: DataSource,
  name: string,
): Promise<DatasetGear> => {
  const nameNormalized = normalizeName(name);
  const repo = con.getRepository(DatasetGear);

  let gear = await repo.findOne({
    where: { nameNormalized },
  });

  if (!gear) {
    gear = repo.create({
      name: name.trim(),
      nameNormalized,
    });
    await repo.save(gear);
  }

  return gear;
};
