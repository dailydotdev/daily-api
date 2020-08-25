import { Connection } from 'typeorm';

export interface Cron {
  name: string;
  handler: (con: Connection, ...args: string[]) => Promise<void>;
}
