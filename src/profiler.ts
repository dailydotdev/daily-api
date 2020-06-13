import * as profiler from '@google-cloud/profiler';

if (process.env.NODE_ENV === 'production') {
  profiler.start({
    serviceContext: {
      service: 'daily-api',
    },
  });
}
