import type { DataSource } from 'typeorm';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { queryReadReplica } from '../queryReadReplica';

export const getChannelHighlightDefinitions = async ({
  con,
}: {
  con: DataSource;
}): Promise<ChannelHighlightDefinition[]> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(ChannelHighlightDefinition).find({
      where: {
        enabled: true,
      },
      order: {
        channel: 'ASC',
      },
    }),
  );

export const getChannelHighlightDefinitionByChannel = async ({
  con,
  channel,
}: {
  con: DataSource;
  channel: string;
}): Promise<ChannelHighlightDefinition | null> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(ChannelHighlightDefinition).findOne({
      where: {
        channel,
        enabled: true,
      },
    }),
  );
