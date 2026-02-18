import { getBragiClient } from '../../integrations/bragi/clients';
import type { JobHandlerParams } from './jobExecute';

export const findContactActivity = async ({
  input,
}: JobHandlerParams): Promise<Record<string, unknown>> => {
  const client = getBragiClient();
  const response = await client.garmr.execute(() =>
    client.instance.findContactActivity({
      firstName: input.firstName as string,
      lastName: input.lastName as string | undefined,
      companyName: input.companyName as string,
      title: input.title as string | undefined,
    }),
  );
  return response.toJson() as Record<string, unknown>;
};
