import { startTelemetry } from '../src/telemetry/opentelemetry';
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
      startTelemetry();
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
      startTelemetry();
      await background();
      break;
    case 'temporal':
      startTelemetry();
      await temporal();
      break;
    case 'cron':
      startTelemetry();
      await cron(positionals[1]);
      process.exit();
      break;
    case 'personalized-digest':
      startTelemetry();
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
