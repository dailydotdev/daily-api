import { DataSource, In } from 'typeorm';
import {
  OpportunityContent,
  Opportunity as OpportunityMessage,
  Location as LocationMessage,
  PreviewType,
} from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { OpportunityLocation } from '../../entity/opportunities/OpportunityLocation';
import { DatasetLocation } from '../../entity/dataset/DatasetLocation';
import { getSecondsTimestamp } from '../date';

export const buildOpportunityPreviewPayload = async ({
  opportunity,
  con,
  previewType,
}: {
  opportunity: OpportunityJob;
  con: DataSource;
  previewType?: PreviewType;
}): Promise<OpportunityMessage> => {
  const keywords = await opportunity.keywords;

  const opportunityContent: Record<string, unknown> = {};
  Object.keys(new OpportunityContent()).forEach((key) => {
    const opportunityKey = key as keyof OpportunityContent;
    opportunityContent[opportunityKey] =
      opportunity.content[opportunityKey] || {};
  });

  const opportunityLocations = await con
    .getRepository(OpportunityLocation)
    .find({
      where: { opportunityId: opportunity.id },
    });

  // Batch fetch all DatasetLocation records to avoid N+1 queries
  const locationIds = opportunityLocations.map((ol) => ol.locationId);
  const datasetLocations =
    locationIds.length > 0
      ? await con.getRepository(DatasetLocation).findBy({ id: In(locationIds) })
      : [];
  const locationMap = new Map(datasetLocations.map((loc) => [loc.id, loc]));

  const locations = opportunityLocations.map((ol) => {
    const datasetLocation = locationMap.get(ol.locationId);

    if (!datasetLocation) {
      return new LocationMessage({
        type: ol.type,
      });
    }

    if (!datasetLocation.country && datasetLocation.continent) {
      return new LocationMessage({
        type: ol.type,
        continent: datasetLocation.continent,
      });
    }

    return new LocationMessage({
      ...datasetLocation,
      type: ol.type,
      city: datasetLocation.city || undefined,
      subdivision: datasetLocation.subdivision || undefined,
      country: datasetLocation.country || undefined,
    });
  });

  if (locations.length === 0) {
    locations.push(
      new LocationMessage({
        iso2: 'US',
        country: 'United States',
      }),
    );
  }

  return new OpportunityMessage({
    id: opportunity.id,
    createdAt: getSecondsTimestamp(opportunity.createdAt),
    updatedAt: getSecondsTimestamp(opportunity.updatedAt),
    type: opportunity.type,
    state: opportunity.state,
    title: opportunity.title,
    tldr: opportunity.tldr,
    content: opportunityContent,
    meta: opportunity.meta,
    location: locations,
    keywords: keywords.map((k) => k.keyword),
    flags: opportunity.flags,
    previewType,
  });
};
