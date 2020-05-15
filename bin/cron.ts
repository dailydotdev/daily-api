import '../src/config';
import cron from '../src/cron';
import { createOrGetConnection } from '../src/db';

const key = process.argv[2];
const selected = cron.get(key);
if (!selected) {
  console.error(`cron "${key}" does not exist!`);
  process.exit(-1);
}

createOrGetConnection()
  .then(selected.handler)
  .then(() => {
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });
