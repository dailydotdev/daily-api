import { Code, ConnectError } from '@connectrpc/connect';
import { FindContactActivityResponse } from '@dailydotdev/schema';
import { getBragiClient } from '../../integrations/bragi/clients';
import type { JobHandlerParams } from './jobExecute';

export const findContactActivity = async ({
  input,
}: JobHandlerParams): Promise<Record<string, unknown>> => {
  const client = getBragiClient();
  try {
    const response = await client.garmr.execute(() =>
      client.instance.findContactActivity({
        firstName: input.firstName as string,
        lastName: input.lastName as string | undefined,
        companyName: input.companyName as string,
        title: input.title as string | undefined,
      }),
    );
    return response.toJson() as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.NotFound) {
      return new FindContactActivityResponse().toJson() as Record<
        string,
        unknown
      >;
    }
    throw err;
  }
};
