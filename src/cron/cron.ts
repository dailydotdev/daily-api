import { Connection } from 'typeorm';

export interface Cron {
  name: string;
  handler: (con: Connection) => Promise<void>;
}
