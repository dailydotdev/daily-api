import { Code, ConnectError } from '@connectrpc/connect';
import { FindJobVacanciesResponse } from '@dailydotdev/schema';
import { getBragiClient } from '../../integrations/bragi/clients';
import type { JobHandlerParams } from './jobExecute';

export const findJobVacancies = async ({
  input,
}: JobHandlerParams): Promise<Record<string, unknown>> => {
  const client = getBragiClient();
  const response = await client.garmr.execute(async () => {
    try {
      return await client.instance.findJobVacancies({
        companyName: input.companyName as string,
        website: input.website as string | undefined,
        emailDomain: input.emailDomain as string | undefined,
      });
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.NotFound) {
        return new FindJobVacanciesResponse();
      }
      throw err;
    }
  });
  return response.toJson() as Record<string, unknown>;
};
