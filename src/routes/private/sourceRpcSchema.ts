import { MethodKind, proto3 } from '@bufbuild/protobuf';
import { Source } from '@dailydotdev/schema';

export const ScrapeSourceRequest = proto3.makeMessageType(
  'dailydotdev.api.sources.ScrapeSourceRequest',
  () => [{ no: 1, name: 'url', kind: 'scalar', T: 9 }],
);

export const ScrapeSourceFeed = proto3.makeMessageType(
  'dailydotdev.api.sources.ScrapeSourceFeed',
  () => [
    { no: 1, name: 'url', kind: 'scalar', T: 9 },
    { no: 2, name: 'title', kind: 'scalar', T: 9, opt: true },
  ],
);

export const ScrapeSourceResponse = proto3.makeMessageType(
  'dailydotdev.api.sources.ScrapeSourceResponse',
  () => [
    { no: 1, name: 'type', kind: 'scalar', T: 9 },
    { no: 2, name: 'name', kind: 'scalar', T: 9, opt: true },
    { no: 3, name: 'logo', kind: 'scalar', T: 9, opt: true },
    { no: 4, name: 'website', kind: 'scalar', T: 9, opt: true },
    {
      no: 5,
      name: 'feeds',
      kind: 'message',
      T: ScrapeSourceFeed,
      repeated: true,
    },
  ],
);

export const CreateSourceRequest = proto3.makeMessageType(
  'dailydotdev.api.sources.CreateSourceRequest',
  () => [
    { no: 1, name: 'id', kind: 'scalar', T: 9 },
    { no: 2, name: 'name', kind: 'scalar', T: 9 },
    { no: 3, name: 'image', kind: 'scalar', T: 9, opt: true },
    { no: 4, name: 'twitter', kind: 'scalar', T: 9, opt: true },
    { no: 5, name: 'website', kind: 'scalar', T: 9, opt: true },
  ],
);

export const CreateSourceResponse = proto3.makeMessageType(
  'dailydotdev.api.sources.CreateSourceResponse',
  () => [{ no: 1, name: 'source', kind: 'message', T: Source }],
);

export const AddSourceFeedRequest = proto3.makeMessageType(
  'dailydotdev.api.sources.AddSourceFeedRequest',
  () => [
    { no: 1, name: 'source_id', kind: 'scalar', T: 9 },
    { no: 2, name: 'feed', kind: 'scalar', T: 9 },
  ],
);

export const AddSourceFeedResponse = proto3.makeMessageType(
  'dailydotdev.api.sources.AddSourceFeedResponse',
  () => [
    { no: 1, name: 'source_id', kind: 'scalar', T: 9 },
    { no: 2, name: 'feed', kind: 'scalar', T: 9 },
  ],
);

export const SourceService = {
  typeName: 'dailydotdev.api.sources.SourceService',
  methods: {
    scrapeSource: {
      name: 'ScrapeSource',
      I: ScrapeSourceRequest,
      O: ScrapeSourceResponse,
      kind: MethodKind.Unary,
    },
    createSource: {
      name: 'CreateSource',
      I: CreateSourceRequest,
      O: CreateSourceResponse,
      kind: MethodKind.Unary,
    },
    addSourceFeed: {
      name: 'AddSourceFeed',
      I: AddSourceFeedRequest,
      O: AddSourceFeedResponse,
      kind: MethodKind.Unary,
    },
  },
} as const;
