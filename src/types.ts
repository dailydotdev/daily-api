export type ChangeObject<Type> = {
  [Property in keyof Type]: Type[Property] extends Date
    ? number
    : Type[Property];
};

export type ChangeSchema = {
  type: string;
  fields: ChangeSchema[];
  optional: boolean;
  name: string;
};

export type ChangeMessage<T> = {
  schema: ChangeSchema;
  payload: {
    before: ChangeObject<T> | null;
    after: ChangeObject<T> | null;
    source: {
      version: string;
      connector: string;
      name: string;
      ts_ms: number;
      snapshot: boolean;
      db: string;
      sequence: string;
      schema: string;
      table: string;
      txId: number;
      lsn: number;
      xmin: number;
    };
    op: 'c' | 'u' | 'd' | 'r';
    ts_ms: number;
    transaction: number;
  };
};
