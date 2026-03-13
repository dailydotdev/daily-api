import {
  type BinaryReadOptions,
  type JsonReadOptions,
  type JsonValue,
  Message,
  MethodKind,
  type PlainMessage,
  proto3,
  type PartialMessage,
} from '@bufbuild/protobuf';
import { Source } from '@dailydotdev/schema';

export class ScrapeSourceRequest extends Message<ScrapeSourceRequest> {
  url = '';

  constructor(data?: PartialMessage<ScrapeSourceRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.ScrapeSourceRequest';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'url', kind: 'scalar', T: 9 },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): ScrapeSourceRequest {
    return new ScrapeSourceRequest().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceRequest {
    return new ScrapeSourceRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceRequest {
    return new ScrapeSourceRequest().fromJsonString(jsonString, options);
  }

  static equals(
    a: ScrapeSourceRequest | PlainMessage<ScrapeSourceRequest> | undefined,
    b: ScrapeSourceRequest | PlainMessage<ScrapeSourceRequest> | undefined,
  ): boolean {
    return proto3.util.equals(ScrapeSourceRequest, a, b);
  }
}

export class ScrapeSourceFeed extends Message<ScrapeSourceFeed> {
  url = '';
  title?: string;

  constructor(data?: PartialMessage<ScrapeSourceFeed>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.ScrapeSourceFeed';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'url', kind: 'scalar', T: 9 },
    { no: 2, name: 'title', kind: 'scalar', T: 9, opt: true },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): ScrapeSourceFeed {
    return new ScrapeSourceFeed().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceFeed {
    return new ScrapeSourceFeed().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceFeed {
    return new ScrapeSourceFeed().fromJsonString(jsonString, options);
  }

  static equals(
    a: ScrapeSourceFeed | PlainMessage<ScrapeSourceFeed> | undefined,
    b: ScrapeSourceFeed | PlainMessage<ScrapeSourceFeed> | undefined,
  ): boolean {
    return proto3.util.equals(ScrapeSourceFeed, a, b);
  }
}

export class ScrapeSourceResponse extends Message<ScrapeSourceResponse> {
  type = '';
  name?: string;
  logo?: string;
  website?: string;
  feeds: ScrapeSourceFeed[] = [];

  constructor(data?: PartialMessage<ScrapeSourceResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.ScrapeSourceResponse';
  static readonly fields = proto3.util.newFieldList(() => [
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
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): ScrapeSourceResponse {
    return new ScrapeSourceResponse().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceResponse {
    return new ScrapeSourceResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): ScrapeSourceResponse {
    return new ScrapeSourceResponse().fromJsonString(jsonString, options);
  }

  static equals(
    a: ScrapeSourceResponse | PlainMessage<ScrapeSourceResponse> | undefined,
    b: ScrapeSourceResponse | PlainMessage<ScrapeSourceResponse> | undefined,
  ): boolean {
    return proto3.util.equals(ScrapeSourceResponse, a, b);
  }
}

export class CreateSourceRequest extends Message<CreateSourceRequest> {
  id = '';
  name = '';
  image?: string;
  twitter?: string;
  website?: string;

  constructor(data?: PartialMessage<CreateSourceRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.CreateSourceRequest';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'id', kind: 'scalar', T: 9 },
    { no: 2, name: 'name', kind: 'scalar', T: 9 },
    { no: 3, name: 'image', kind: 'scalar', T: 9, opt: true },
    { no: 4, name: 'twitter', kind: 'scalar', T: 9, opt: true },
    { no: 5, name: 'website', kind: 'scalar', T: 9, opt: true },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): CreateSourceRequest {
    return new CreateSourceRequest().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): CreateSourceRequest {
    return new CreateSourceRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): CreateSourceRequest {
    return new CreateSourceRequest().fromJsonString(jsonString, options);
  }

  static equals(
    a: CreateSourceRequest | PlainMessage<CreateSourceRequest> | undefined,
    b: CreateSourceRequest | PlainMessage<CreateSourceRequest> | undefined,
  ): boolean {
    return proto3.util.equals(CreateSourceRequest, a, b);
  }
}

export class CreateSourceResponse extends Message<CreateSourceResponse> {
  source?: Source;

  constructor(data?: PartialMessage<CreateSourceResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.CreateSourceResponse';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'source', kind: 'message', T: Source },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): CreateSourceResponse {
    return new CreateSourceResponse().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): CreateSourceResponse {
    return new CreateSourceResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): CreateSourceResponse {
    return new CreateSourceResponse().fromJsonString(jsonString, options);
  }

  static equals(
    a: CreateSourceResponse | PlainMessage<CreateSourceResponse> | undefined,
    b: CreateSourceResponse | PlainMessage<CreateSourceResponse> | undefined,
  ): boolean {
    return proto3.util.equals(CreateSourceResponse, a, b);
  }
}

export class AddSourceFeedRequest extends Message<AddSourceFeedRequest> {
  sourceId = '';
  feed = '';

  constructor(data?: PartialMessage<AddSourceFeedRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.AddSourceFeedRequest';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'source_id', kind: 'scalar', T: 9 },
    { no: 2, name: 'feed', kind: 'scalar', T: 9 },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): AddSourceFeedRequest {
    return new AddSourceFeedRequest().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): AddSourceFeedRequest {
    return new AddSourceFeedRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): AddSourceFeedRequest {
    return new AddSourceFeedRequest().fromJsonString(jsonString, options);
  }

  static equals(
    a: AddSourceFeedRequest | PlainMessage<AddSourceFeedRequest> | undefined,
    b: AddSourceFeedRequest | PlainMessage<AddSourceFeedRequest> | undefined,
  ): boolean {
    return proto3.util.equals(AddSourceFeedRequest, a, b);
  }
}

export class AddSourceFeedResponse extends Message<AddSourceFeedResponse> {
  sourceId = '';
  feed = '';

  constructor(data?: PartialMessage<AddSourceFeedResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = 'dailydotdev.api.sources.AddSourceFeedResponse';
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: 'source_id', kind: 'scalar', T: 9 },
    { no: 2, name: 'feed', kind: 'scalar', T: 9 },
  ]);

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<BinaryReadOptions>,
  ): AddSourceFeedResponse {
    return new AddSourceFeedResponse().fromBinary(bytes, options);
  }

  static fromJson(
    jsonValue: JsonValue,
    options?: Partial<JsonReadOptions>,
  ): AddSourceFeedResponse {
    return new AddSourceFeedResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<JsonReadOptions>,
  ): AddSourceFeedResponse {
    return new AddSourceFeedResponse().fromJsonString(jsonString, options);
  }

  static equals(
    a: AddSourceFeedResponse | PlainMessage<AddSourceFeedResponse> | undefined,
    b: AddSourceFeedResponse | PlainMessage<AddSourceFeedResponse> | undefined,
  ): boolean {
    return proto3.util.equals(AddSourceFeedResponse, a, b);
  }
}

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
