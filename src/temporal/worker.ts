import { NativeConnection } from '@temporalio/worker';
import { TEMPORAL_ADDRESS } from './config';

export const getTemporalWorkerConnection = () =>
  NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });
