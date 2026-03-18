import type { DataSource } from 'typeorm';
import { ChannelDigest } from '../../entity/ChannelDigest';
import { ONE_DAY_IN_SECONDS, ONE_WEEK_IN_SECONDS } from '../constants';
import { queryReadReplica } from '../queryReadReplica';

export const getChannelDigestDefinitions = async ({
  con,
}: {
  con: DataSource;
}): Promise<ChannelDigest[]> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(ChannelDigest).find({
      where: {
        enabled: true,
      },
      order: {
        key: 'ASC',
      },
    }),
  );

export const getChannelDigestDefinitionByKey = async ({
  con,
  key,
}: {
  con: DataSource;
  key: string;
}): Promise<ChannelDigest | null> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(ChannelDigest).findOne({
      where: {
        key,
        enabled: true,
      },
    }),
  );

export const isChannelDigestScheduledForDate = ({
  definition,
  now,
}: {
  definition: Pick<ChannelDigest, 'frequency'>;
  now: Date;
}): boolean => {
  switch (definition.frequency) {
    case 'weekly':
      return now.getUTCDay() === 1;
    case 'daily':
    default:
      return true;
  }
};

export const getChannelDigestLookbackSeconds = (
  definition: Pick<ChannelDigest, 'frequency'>,
): number => {
  switch (definition.frequency) {
    case 'weekly':
      return ONE_WEEK_IN_SECONDS;
    case 'daily':
    default:
      return ONE_DAY_IN_SECONDS;
  }
};
