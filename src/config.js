const env = process.env.NODE_ENV || 'development';
const port = Number.parseInt(process.env.PORT, 10) || 3000;

const config = {
  env,
  port,
};

export default config;
