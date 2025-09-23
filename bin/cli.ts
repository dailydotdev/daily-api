import { tracer } from '../src/telemetry/opentelemetry';
import { startMetrics } from '../src/telemetry/metrics';
import { parseArgs } from 'node:util';
import api from '../src';
import background from '../src/background';
import temporal from '../src/temporal/notifications';
import cron from '../src/cron';
import personalizedDigest from '../src/commands/personalizedDigest';
import { remoteConfig } from '../src/remoteConfig';
import { initGeoReader } from '../src/common/geo';

async function run(positionals: string[]) {
  await remoteConfig.init();

  switch (positionals[0]) {
    case 'api':
      tracer('api').start();
      await startMetrics('api');

      await initGeoReader();

      const app = await api();
      await app.listen({
        port: parseInt(process.env.PORT) || 3000,
        host: '0.0.0.0',
      });
      break;
    case 'websocket':
      const websocketApp = await api();
      await websocketApp.listen({
        port: parseInt(process.env.PORT) || 3000,
        host: '0.0.0.0',
      });
      break;
    case 'background':
      tracer('background').start();
      await startMetrics('background');
      await background();
      break;
    case 'temporal':
      tracer('temporal').start();
      await startMetrics('temporal');
      await temporal();
      break;
    case 'cron':
      tracer('cron').start();
      await startMetrics('cron');
      await cron(positionals[1]);
      process.exit();
      break;
    case 'personalized-digest':
      tracer('personalized-digest').start();
      await startMetrics('personalized-digest');
      await personalizedDigest();
      break;
    default:
      console.log('unknown command');
      process.exit();
      break;
  }
}

const { positionals } = parseArgs({
  allowPositionals: true,
});

run(positionals).catch((err) => {
  console.error(err);
  process.exit(1);
});
