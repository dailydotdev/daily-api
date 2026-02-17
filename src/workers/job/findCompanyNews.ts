import { getBragiClient } from '../../integrations/bragi/clients';
import type { JobHandlerParams } from './jobExecute';

export const findCompanyNews = async ({
  input,
}: JobHandlerParams): Promise<Record<string, unknown>> => {
  const client = getBragiClient();
  const response = await client.garmr.execute(() =>
    client.instance.findCompanyNews({
      companyName: input.companyName as string,
      website: input.website as string | undefined,
      country: input.country as string | undefined,
      emailDomain: input.emailDomain as string | undefined,
    }),
  );
  return response.toJson() as Record<string, unknown>;
};
