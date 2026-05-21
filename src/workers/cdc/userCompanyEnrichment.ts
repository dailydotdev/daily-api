import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { UserCompany } from '../../entity/UserCompany';
import type { ChangeMessage } from '../../types';
import { enrichCompanyForUserCompany } from '../../common/companyEnrichment';
import { getTableName } from './common';
import { messageToJson } from '../worker';
import type { Worker } from '../worker';

const shouldEnrichUserCompany = (data: ChangeMessage<UserCompany>): boolean => {
  const { after, before, op } = data.payload;

  if (!after?.email || after.companyId !== null) {
    return false;
  }

  if (op === 'c') {
    return true;
  }

  return (
    op === 'u' &&
    before?.companyId === null &&
    !before?.verified &&
    !!after.verified
  );
};

const onUserCompanyChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<UserCompany>,
): Promise<void> => {
  if (!shouldEnrichUserCompany(data)) {
    return;
  }

  const after = data.payload.after;
  if (!after) {
    return;
  }

  const domain = after.email.toLowerCase().split('@')[1];
  if (!domain) {
    return;
  }

  await enrichCompanyForUserCompany(
    con,
    {
      userCompanyEmail: after.email,
      userCompanyUserId: after.userId,
      domain,
    },
    logger,
  );
};

const worker: Worker = {
  subscription: 'api.user-company-enrichment',
  handler: async (message, con, logger): Promise<void> => {
    try {
      const data: ChangeMessage<unknown> = messageToJson(message);
      if (
        data.schema.name === 'io.debezium.connector.common.Heartbeat' ||
        data.payload.op === 'r' ||
        data.payload.source.table !== getTableName(con, UserCompany)
      ) {
        return;
      }

      await onUserCompanyChange(
        con,
        logger,
        data as ChangeMessage<UserCompany>,
      );
    } catch (err) {
      logger.error(
        {
          messageId: message.messageId,
          err,
        },
        'failed to handle user company enrichment cdc message',
      );
      throw err;
    }
  },
};

export default worker;
