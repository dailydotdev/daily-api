import type { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { uploadToolIcon } from './cloudinary';

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';
const DEVICON_CDN = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
const ICONIFY_API = 'https://api.iconify.design/logos';

export type IconSource = 'simple-icons' | 'devicon' | 'iconify' | 'none';

// Known slug mappings for technologies where the icon library slug differs from the normalized title
// Keys should be the normalized title (lowercase, no special chars)
const ICON_SLUG_MAPPINGS: Record<
  string,
  { simpleIcons?: string; devicon?: string; iconify?: string }
> = {
  // Languages
  java: { devicon: 'java', iconify: 'java' }, // Simple Icons doesn't have Java
  javascript: {
    simpleIcons: 'javascript',
    devicon: 'javascript',
    iconify: 'javascript',
  },
  typescript: {
    simpleIcons: 'typescript',
    devicon: 'typescript',
    iconify: 'typescript',
  },
  csharp: { simpleIcons: 'csharp', devicon: 'csharp', iconify: 'csharp' },
  cplusplus: {
    simpleIcons: 'cplusplus',
    devicon: 'cplusplus',
    iconify: 'cplusplus',
  },
  c: { simpleIcons: 'c', devicon: 'c', iconify: 'c' },
  python: { simpleIcons: 'python', devicon: 'python', iconify: 'python' },
  ruby: { simpleIcons: 'ruby', devicon: 'ruby', iconify: 'ruby' },
  rust: { simpleIcons: 'rust', devicon: 'rust', iconify: 'rust' },
  go: { simpleIcons: 'go', devicon: 'go', iconify: 'go' },
  kotlin: { simpleIcons: 'kotlin', devicon: 'kotlin', iconify: 'kotlin' },
  swift: { simpleIcons: 'swift', devicon: 'swift', iconify: 'swift' },
  scala: { simpleIcons: 'scala', devicon: 'scala', iconify: 'scala' },
  php: { simpleIcons: 'php', devicon: 'php', iconify: 'php' },
  perl: { simpleIcons: 'perl', devicon: 'perl', iconify: 'perl' },
  r: { simpleIcons: 'r', devicon: 'r', iconify: 'r' },
  dart: { simpleIcons: 'dart', devicon: 'dart', iconify: 'dart' },
  elixir: { simpleIcons: 'elixir', devicon: 'elixir', iconify: 'elixir' },
  erlang: { simpleIcons: 'erlang', devicon: 'erlang', iconify: 'erlang' },
  haskell: { simpleIcons: 'haskell', devicon: 'haskell', iconify: 'haskell' },
  lua: { simpleIcons: 'lua', devicon: 'lua', iconify: 'lua' },
  clojure: { simpleIcons: 'clojure', devicon: 'clojure', iconify: 'clojure' },

  // Frameworks and Runtimes
  nodejs: { simpleIcons: 'nodedotjs', devicon: 'nodejs', iconify: 'nodejs' },
  nodedotjs: {
    simpleIcons: 'nodedotjs',
    devicon: 'nodejs',
    iconify: 'nodejs',
  },
  dotnet: { simpleIcons: 'dotnet', devicon: 'dot-net', iconify: 'dotnet' },
  dotnetcore: {
    simpleIcons: 'dotnet',
    devicon: 'dotnetcore',
    iconify: 'dotnet',
  },
  react: { simpleIcons: 'react', devicon: 'react', iconify: 'react' },
  reactjs: { simpleIcons: 'react', devicon: 'react', iconify: 'react' },
  angular: { simpleIcons: 'angular', devicon: 'angular', iconify: 'angular' },
  angularjs: {
    simpleIcons: 'angular',
    devicon: 'angularjs',
    iconify: 'angular',
  },
  vue: { simpleIcons: 'vuedotjs', devicon: 'vuejs', iconify: 'vue' },
  vuejs: { simpleIcons: 'vuedotjs', devicon: 'vuejs', iconify: 'vue' },
  vuedotjs: { simpleIcons: 'vuedotjs', devicon: 'vuejs', iconify: 'vue' },
  svelte: { simpleIcons: 'svelte', devicon: 'svelte', iconify: 'svelte' },
  nextjs: { simpleIcons: 'nextdotjs', devicon: 'nextjs', iconify: 'nextjs' },
  nextdotjs: {
    simpleIcons: 'nextdotjs',
    devicon: 'nextjs',
    iconify: 'nextjs',
  },
  nuxtjs: { simpleIcons: 'nuxtdotjs', devicon: 'nuxtjs', iconify: 'nuxt' },
  nuxtdotjs: { simpleIcons: 'nuxtdotjs', devicon: 'nuxtjs', iconify: 'nuxt' },
  django: { simpleIcons: 'django', devicon: 'django', iconify: 'django' },
  flask: { simpleIcons: 'flask', devicon: 'flask', iconify: 'flask' },
  fastapi: { simpleIcons: 'fastapi', devicon: 'fastapi', iconify: 'fastapi' },
  rails: { simpleIcons: 'rubyonrails', devicon: 'rails', iconify: 'rails' },
  rubyonrails: {
    simpleIcons: 'rubyonrails',
    devicon: 'rails',
    iconify: 'rails',
  },
  spring: { simpleIcons: 'spring', devicon: 'spring', iconify: 'spring' },
  springboot: {
    simpleIcons: 'springboot',
    devicon: 'spring',
    iconify: 'spring',
  },
  express: { simpleIcons: 'express', devicon: 'express', iconify: 'express' },
  expressjs: {
    simpleIcons: 'express',
    devicon: 'express',
    iconify: 'express',
  },
  nestjs: { simpleIcons: 'nestjs', devicon: 'nestjs', iconify: 'nestjs' },
  laravel: { simpleIcons: 'laravel', devicon: 'laravel', iconify: 'laravel' },
  symfony: { simpleIcons: 'symfony', devicon: 'symfony', iconify: 'symfony' },

  // Databases
  postgresql: {
    simpleIcons: 'postgresql',
    devicon: 'postgresql',
    iconify: 'postgresql',
  },
  postgres: {
    simpleIcons: 'postgresql',
    devicon: 'postgresql',
    iconify: 'postgresql',
  },
  mysql: { simpleIcons: 'mysql', devicon: 'mysql', iconify: 'mysql' },
  mongodb: { simpleIcons: 'mongodb', devicon: 'mongodb', iconify: 'mongodb' },
  redis: { simpleIcons: 'redis', devicon: 'redis', iconify: 'redis' },
  sqlite: { simpleIcons: 'sqlite', devicon: 'sqlite', iconify: 'sqlite' },
  elasticsearch: {
    simpleIcons: 'elasticsearch',
    devicon: 'elasticsearch',
    iconify: 'elasticsearch',
  },
  cassandra: {
    simpleIcons: 'apachecassandra',
    devicon: 'cassandra',
    iconify: 'cassandra',
  },
  dynamodb: {
    simpleIcons: 'amazondynamodb',
    devicon: 'dynamodb',
    iconify: 'dynamodb',
  },

  // Cloud and DevOps
  aws: {
    simpleIcons: 'amazonwebservices',
    devicon: 'amazonwebservices',
    iconify: 'aws',
  },
  amazonwebservices: {
    simpleIcons: 'amazonwebservices',
    devicon: 'amazonwebservices',
    iconify: 'aws',
  },
  azure: { simpleIcons: 'microsoftazure', devicon: 'azure', iconify: 'azure' },
  microsoftazure: {
    simpleIcons: 'microsoftazure',
    devicon: 'azure',
    iconify: 'azure',
  },
  gcp: {
    simpleIcons: 'googlecloud',
    devicon: 'googlecloud',
    iconify: 'google-cloud',
  },
  googlecloud: {
    simpleIcons: 'googlecloud',
    devicon: 'googlecloud',
    iconify: 'google-cloud',
  },
  docker: { simpleIcons: 'docker', devicon: 'docker', iconify: 'docker' },
  kubernetes: {
    simpleIcons: 'kubernetes',
    devicon: 'kubernetes',
    iconify: 'kubernetes',
  },
  k8s: {
    simpleIcons: 'kubernetes',
    devicon: 'kubernetes',
    iconify: 'kubernetes',
  },
  terraform: {
    simpleIcons: 'terraform',
    devicon: 'terraform',
    iconify: 'terraform',
  },
  ansible: { simpleIcons: 'ansible', devicon: 'ansible', iconify: 'ansible' },
  jenkins: { simpleIcons: 'jenkins', devicon: 'jenkins', iconify: 'jenkins' },
  circleci: {
    simpleIcons: 'circleci',
    devicon: 'circleci',
    iconify: 'circleci',
  },
  github: { simpleIcons: 'github', devicon: 'github', iconify: 'github' },
  gitlab: { simpleIcons: 'gitlab', devicon: 'gitlab', iconify: 'gitlab' },
  bitbucket: {
    simpleIcons: 'bitbucket',
    devicon: 'bitbucket',
    iconify: 'bitbucket',
  },

  // Mobile
  android: { simpleIcons: 'android', devicon: 'android', iconify: 'android' },
  ios: { simpleIcons: 'ios', devicon: 'apple', iconify: 'apple' },
  flutter: { simpleIcons: 'flutter', devicon: 'flutter', iconify: 'flutter' },
  reactnative: {
    simpleIcons: 'react',
    devicon: 'react',
    iconify: 'react',
  },

  // Tools and Others
  graphql: { simpleIcons: 'graphql', devicon: 'graphql', iconify: 'graphql' },
  webpack: { simpleIcons: 'webpack', devicon: 'webpack', iconify: 'webpack' },
  babel: { simpleIcons: 'babel', devicon: 'babel', iconify: 'babel' },
  eslint: { simpleIcons: 'eslint', devicon: 'eslint', iconify: 'eslint' },
  prettier: {
    simpleIcons: 'prettier',
    devicon: 'prettier',
    iconify: 'prettier',
  },
  jest: { simpleIcons: 'jest', devicon: 'jest', iconify: 'jest' },
  mocha: { simpleIcons: 'mocha', devicon: 'mocha', iconify: 'mocha' },
  git: { simpleIcons: 'git', devicon: 'git', iconify: 'git' },
  npm: { simpleIcons: 'npm', devicon: 'npm', iconify: 'npm' },
  yarn: { simpleIcons: 'yarn', devicon: 'yarn', iconify: 'yarn' },
  pnpm: { simpleIcons: 'pnpm', devicon: 'pnpm', iconify: 'pnpm' },
  vscode: {
    simpleIcons: 'visualstudiocode',
    devicon: 'vscode',
    iconify: 'visual-studio-code',
  },
  visualstudiocode: {
    simpleIcons: 'visualstudiocode',
    devicon: 'vscode',
    iconify: 'visual-studio-code',
  },
  intellij: {
    simpleIcons: 'intellijidea',
    devicon: 'intellij',
    iconify: 'intellij-idea',
  },
  intellijidea: {
    simpleIcons: 'intellijidea',
    devicon: 'intellij',
    iconify: 'intellij-idea',
  },
  vim: { simpleIcons: 'vim', devicon: 'vim', iconify: 'vim' },
  neovim: { simpleIcons: 'neovim', devicon: 'neovim', iconify: 'neovim' },
  linux: { simpleIcons: 'linux', devicon: 'linux', iconify: 'linux' },
  ubuntu: { simpleIcons: 'ubuntu', devicon: 'ubuntu', iconify: 'ubuntu' },
  debian: { simpleIcons: 'debian', devicon: 'debian', iconify: 'debian' },
  centos: { simpleIcons: 'centos', devicon: 'centos', iconify: 'centos' },
  nginx: { simpleIcons: 'nginx', devicon: 'nginx', iconify: 'nginx' },
  apache: { simpleIcons: 'apache', devicon: 'apache', iconify: 'apache' },
  tailwindcss: {
    simpleIcons: 'tailwindcss',
    devicon: 'tailwindcss',
    iconify: 'tailwindcss',
  },
  bootstrap: {
    simpleIcons: 'bootstrap',
    devicon: 'bootstrap',
    iconify: 'bootstrap',
  },
  sass: { simpleIcons: 'sass', devicon: 'sass', iconify: 'sass' },
  less: { simpleIcons: 'less', devicon: 'less', iconify: 'less' },
  html: { simpleIcons: 'html5', devicon: 'html5', iconify: 'html-5' },
  html5: { simpleIcons: 'html5', devicon: 'html5', iconify: 'html-5' },
  css: { simpleIcons: 'css3', devicon: 'css3', iconify: 'css-3' },
  css3: { simpleIcons: 'css3', devicon: 'css3', iconify: 'css-3' },
  firebase: {
    simpleIcons: 'firebase',
    devicon: 'firebase',
    iconify: 'firebase',
  },
  supabase: {
    simpleIcons: 'supabase',
    devicon: 'supabase',
    iconify: 'supabase',
  },
  vercel: { simpleIcons: 'vercel', devicon: 'vercel', iconify: 'vercel' },
  netlify: { simpleIcons: 'netlify', devicon: 'netlify', iconify: 'netlify' },
  heroku: { simpleIcons: 'heroku', devicon: 'heroku', iconify: 'heroku' },
  figma: { simpleIcons: 'figma', devicon: 'figma', iconify: 'figma' },
  sketch: { simpleIcons: 'sketch', devicon: 'sketch', iconify: 'sketch' },
  adobexd: { simpleIcons: 'adobexd', devicon: 'xd', iconify: 'adobe-xd' },
  photoshop: {
    simpleIcons: 'adobephotoshop',
    devicon: 'photoshop',
    iconify: 'adobe-photoshop',
  },
  illustrator: {
    simpleIcons: 'adobeillustrator',
    devicon: 'illustrator',
    iconify: 'adobe-illustrator',
  },
  unity: { simpleIcons: 'unity', devicon: 'unity', iconify: 'unity' },
  unreal: {
    simpleIcons: 'unrealengine',
    devicon: 'unrealengine',
    iconify: 'unreal-engine',
  },
  unrealengine: {
    simpleIcons: 'unrealengine',
    devicon: 'unrealengine',
    iconify: 'unreal-engine',
  },
  blender: { simpleIcons: 'blender', devicon: 'blender', iconify: 'blender' },
  threejs: {
    simpleIcons: 'threedotjs',
    devicon: 'threejs',
    iconify: 'threejs',
  },
  threedotjs: {
    simpleIcons: 'threedotjs',
    devicon: 'threejs',
    iconify: 'threejs',
  },
  opencv: { simpleIcons: 'opencv', devicon: 'opencv', iconify: 'opencv' },
  tensorflow: {
    simpleIcons: 'tensorflow',
    devicon: 'tensorflow',
    iconify: 'tensorflow',
  },
  pytorch: { simpleIcons: 'pytorch', devicon: 'pytorch', iconify: 'pytorch' },
  jupyter: { simpleIcons: 'jupyter', devicon: 'jupyter', iconify: 'jupyter' },
  pandas: { simpleIcons: 'pandas', devicon: 'pandas', iconify: 'pandas' },
  numpy: { simpleIcons: 'numpy', devicon: 'numpy', iconify: 'numpy' },
  socketio: {
    simpleIcons: 'socketdotio',
    devicon: 'socketio',
    iconify: 'socket-io',
  },
  socketdotio: {
    simpleIcons: 'socketdotio',
    devicon: 'socketio',
    iconify: 'socket-io',
  },
  rabbitmq: {
    simpleIcons: 'rabbitmq',
    devicon: 'rabbitmq',
    iconify: 'rabbitmq',
  },
  kafka: {
    simpleIcons: 'apachekafka',
    devicon: 'apachekafka',
    iconify: 'kafka',
  },
  apachekafka: {
    simpleIcons: 'apachekafka',
    devicon: 'apachekafka',
    iconify: 'kafka',
  },
  prometheus: {
    simpleIcons: 'prometheus',
    devicon: 'prometheus',
    iconify: 'prometheus',
  },
  grafana: { simpleIcons: 'grafana', devicon: 'grafana', iconify: 'grafana' },
  datadog: { simpleIcons: 'datadog', devicon: 'datadog', iconify: 'datadog' },
  sentry: { simpleIcons: 'sentry', devicon: 'sentry', iconify: 'sentry' },
  jira: { simpleIcons: 'jira', devicon: 'jira', iconify: 'jira' },
  confluence: {
    simpleIcons: 'confluence',
    devicon: 'confluence',
    iconify: 'confluence',
  },
  slack: { simpleIcons: 'slack', devicon: 'slack', iconify: 'slack' },
  notion: { simpleIcons: 'notion', devicon: 'notion', iconify: 'notion' },
  trello: { simpleIcons: 'trello', devicon: 'trello', iconify: 'trello' },
};

export const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/\./g, 'dot')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '');

// Get the appropriate slug for a given icon source
export const getIconSlug = (
  title: string,
  source: Exclude<IconSource, 'none'>,
): string => {
  const normalizedTitle = normalizeTitle(title);
  const mapping = ICON_SLUG_MAPPINGS[normalizedTitle];

  if (mapping) {
    const sourceKey =
      source === 'simple-icons'
        ? 'simpleIcons'
        : source === 'devicon'
          ? 'devicon'
          : 'iconify';
    if (mapping[sourceKey]) {
      return mapping[sourceKey];
    }
  }

  // Fallback to normalized title
  return normalizedTitle;
};

const tryFetchIcon = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
};

export const fetchAndUploadToolIcon = async (
  toolId: string,
  title: string,
): Promise<{ url: string; source: IconSource } | null> => {
  // Simple Icons - use slug mapping
  const simpleIconsSlug = getIconSlug(title, 'simple-icons');

  // Devicon - use slug mapping
  const deviconSlug = getIconSlug(title, 'devicon');

  // Iconify - use slug mapping
  const iconifySlug = getIconSlug(title, 'iconify');

  const sources: Array<{
    url: string;
    source: Exclude<IconSource, 'none'>;
  }> = [
    {
      url: `${SIMPLE_ICONS_CDN}/${simpleIconsSlug}`,
      source: 'simple-icons',
    },
    {
      url: `${DEVICON_CDN}/${deviconSlug}/${deviconSlug}-original.svg`,
      source: 'devicon',
    },
    {
      url: `${ICONIFY_API}:${iconifySlug}.svg`,
      source: 'iconify',
    },
  ];

  // Try each source in order
  for (const { url, source } of sources) {
    const svgBuffer = await tryFetchIcon(url);
    if (svgBuffer) {
      try {
        const stream = Readable.from(svgBuffer);
        const result = await uploadToolIcon(toolId, stream);
        return { url: result.url, source };
      } catch {
        // Continue to next source if upload fails
        continue;
      }
    }
  }

  return null;
};

export const findOrCreateDatasetTool = async (
  con: DataSource,
  title: string,
): Promise<DatasetTool> => {
  const titleNormalized = normalizeTitle(title);
  const repo = con.getRepository(DatasetTool);

  let tool = await repo.findOne({
    where: { titleNormalized },
  });

  if (!tool) {
    tool = repo.create({
      title: title.trim(),
      titleNormalized,
      faviconSource: 'none',
    });
    await repo.save(tool);

    const iconResult = await fetchAndUploadToolIcon(tool.id, title);
    if (iconResult) {
      tool.faviconUrl = iconResult.url;
      tool.faviconSource = iconResult.source;
      await repo.save(tool);
    }
  }

  return tool;
};
