import { run } from './notifications';

run()
  .then(() => {
    console.log('registered worker');
  })
  .catch((err) => {
    console.log('error registering worker');
    console.error(err);
    process.exit(1);
  });
