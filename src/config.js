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
  defaultImage: {
    url: process.env.DEFAULT_IMAGE_URL,
    ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
    placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
  },
  cookies: {
    domain: process.env.COOKIES_DOMAIN,
    key: process.env.COOKIES_KEY,
  },
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN : '*',
  },
  twitter: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessTokenKey: process.env.TWITTER_ACCESS_TOKEN_KEY,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  },
  urlPrefix: process.env.URL_PREFIX,
};

export default config;
