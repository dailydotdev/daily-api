import { tracer } from '../src/opentelemetry';
import { parseArgs } from 'node:util';
import api from '../src';
import background from '../src/background';
import cron from '../src/cron';

async function run(positionals) {
  switch (positionals[0]) {
    case 'api':
      tracer('api').start();
      const app = await api();
      await app.listen({
        port: parseInt(process.env.PORT) || 3000,
        host: '0.0.0.0',
      });
      break;
    case 'background':
      await background();
      break;
    case 'cron':
      await cron(positionals[1]);
      process.exit();
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
