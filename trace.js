if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line
  require('@google-cloud/trace-agent').start();
}
