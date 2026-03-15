import { DataSource } from 'typeorm';
import {
  ProvisionSourceRequest,
  ProvisionSourceResponse,
  Source as RpcSource,
} from '@dailydotdev/schema';
import { MachineSource, SourceType } from '../../entity';
import { getSecondsTimestamp } from '../../common';
import { pubsub } from '../../common/pubsub';
import {
  buildProvisionPlan,
  validateProvisionRequest,
} from './provisionSourcePlan';
import { resolveProvisionSourceData } from './provisionSourceMetadata';
import { ProvisionSourceData } from './provisionSourceTypes';

const saveProvisionedSource = async ({
  con,
  req,
  sourceData,
}: {
  con: DataSource;
  req: ProvisionSourceRequest;
  sourceData: ProvisionSourceData;
}): Promise<MachineSource> =>
  con.getRepository(MachineSource).save({
    id: req.sourceId,
    handle: req.sourceId,
    name: sourceData.name,
    ...(sourceData.image ? { image: sourceData.image } : {}),
    ...(sourceData.twitter ? { twitter: sourceData.twitter } : {}),
    ...(sourceData.website ? { website: sourceData.website } : {}),
  });

const toRpcSource = (source: MachineSource): RpcSource =>
  new RpcSource({
    id: source.id,
    type: SourceType.Machine,
    createdAt: getSecondsTimestamp(source.createdAt),
    active: source.active,
    name: source.name,
    image: source.image,
    private: source.private,
    handle: source.handle,
    twitter: source.twitter,
    website: source.website,
    description: source.description,
  });

export const provisionSource = async (
  req: ProvisionSourceRequest,
  con: DataSource,
): Promise<ProvisionSourceResponse> => {
  validateProvisionRequest(req);

  const plan = buildProvisionPlan(req);
  const sourceData = await resolveProvisionSourceData({
    req,
    scrapeUrl: plan.scrapeUrl,
  });
  const source = await saveProvisionedSource({
    con,
    req,
    sourceData,
  });

  await pubsub.topic('source-added').publishMessage({
    json: plan.publishMessage,
  });

  return new ProvisionSourceResponse({
    source: toRpcSource(source),
    ingestion: plan.ingestion,
  });
};
