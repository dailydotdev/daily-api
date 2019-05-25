const env = process.env.NODE_ENV || 'development';
const port = Number.parseInt(process.env.PORT, 10) || 3000;

const getMysqlConfig = () => {
  const base = {
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    pool: { min: 2, max: 100 },
    acquireConnectionTimeout: 10000,
  };

  if (process.env.MYSQL_INSTANCE && process.env.NODE_ENV === 'production') {
    return Object.assign({}, base, { socketPath: `/cloudsql/${process.env.MYSQL_INSTANCE}` });
  }

  if (process.env.MYSQL_HOST) {
    return Object.assign({}, base, { host: process.env.MYSQL_HOST });
  }

  return base;
};

const config = {
  env,
  port,
  mysql: getMysqlConfig(),
  admin: process.env.ADMIN_KEY,
  defaultImage: {
    url: process.env.DEFAULT_IMAGE_URL.split(','),
    ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
    placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
  },
  cookies: {
    opts: {
      domain: process.env.COOKIES_DOMAIN,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      overwrite: true,
      httpOnly: false,
      signed: false,
    },
    secret: process.env.COOKIES_KEY,
    key: 'da2',
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
  jwt: {
    secret: process.env.JWT_SECRET,
    audience: process.env.JWT_AUDIENCE,
    issuer: process.env.JWT_ISSUER,
    expiresIn: 30 * 24 * 60 * 60 * 1000,
  },
};

export default config;
