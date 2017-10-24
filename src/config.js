const env = process.env.NODE_ENV || 'development';
const port = Number.parseInt(process.env.PORT, 10) || 3000;

const getMysqlConfig = () => {
  const base = {
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };

  if (process.env.MYSQL_INSTANCE && process.env.NODE_ENV === 'production') {
    return Object.assign({}, base, { socketPath: `/cloudsql/${process.env.MYSQL_INSTANCE}` });
  }

  return base;
};

const config = {
  env,
  port,
  mysql: getMysqlConfig(),
  admin: process.env.ADMIN_KEY,
};

export default config;
