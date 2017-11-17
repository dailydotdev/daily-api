#!/usr/bin/env node

import { createTables } from './src/db';

createTables()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('created!');
    process.exit();
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
