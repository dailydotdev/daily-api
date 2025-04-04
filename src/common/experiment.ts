import { ExperimentVariant, type ConnectionManager } from '../entity';

export const getExperimentVariant = (
  con: ConnectionManager,
  feature: string,
  variant: string,
) =>
  con.getRepository(ExperimentVariant).findOne({ where: { feature, variant } });
