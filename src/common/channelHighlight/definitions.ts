import type { DataSource } from 'typeorm';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';

export const getChannelHighlightDefinitions = async ({
  con,
}: {
  con: DataSource;
}): Promise<ChannelHighlightDefinition[]> =>
  con.getRepository(ChannelHighlightDefinition).find({
    where: {
      enabled: true,
    },
    order: {
      channel: 'ASC',
    },
  });

export const getChannelHighlightDefinitionByChannel = async ({
  con,
  channel,
}: {
  con: DataSource;
  channel: string;
}): Promise<ChannelHighlightDefinition | null> =>
  con.getRepository(ChannelHighlightDefinition).findOne({
    where: {
      channel,
      enabled: true,
    },
  });
