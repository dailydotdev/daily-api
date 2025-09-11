load('ext://pulumi', 'pulumi_resource')
load('ext://uibutton', 'cmd_button', 'location')
update_settings(k8s_upsert_timeout_secs=300)

docker_build(
  'api-image',
  context='.',
  dockerfile='./Dockerfile.dev',
  ignore=[
    './node_modules',
    './.infra',
    '__tests__',
    './seeds',
    './build',
  ],
  live_update=[
    sync('./src', '/opt/app/src'),
    sync('./bin', '/opt/app/bin'),
    run(
      'pnpm install',
      trigger=['./package.json', './pnpm-lock.yaml']
    )
  ])

pulumi_resource(
  'api',
  stack='adhoc',
  dir='.infra/',
  deps=[
    '.infra/index.ts',
    '.infra/workers.ts',
    '.infra/.env',
  ],
  image_deps=['api-image'],
  image_configs=['image'],
)

# Add a button to API to run pulumi up
cmd_button(
  name='api_pulumi_up',
  resource='api',
  text='Run pulumi up',
  icon_name='arrow_circle_up',
  requires_confirmation=True,
  dir='./.infra',
  argv=[
    'pulumi', 'up',
    '--stack', 'adhoc',
    '--yes',
    '--skip-preview',
  ],
)

# Add a button to API to seed the database
cmd_button(
  name="db_seed",
  resource="api",
  text="Seed Database",
  icon_name="repartition",
  requires_confirmation=True,
  argv=["npm", "run", "db:seed:import"],
)

# Add a button to API to run db migrations
cmd_button(
  name="db_migrate",
  resource="api",
  text="Run database migrations",
  icon_name="dns",
  requires_confirmation=True,
  argv=["npm", "run", "db:migrate:latest"],
)

# Add a button to API to run db rollback
cmd_button(
  name="db_rollback",
  resource="api",
  text="Run database rollback",
  icon_name="settings_backup_restore",
  requires_confirmation=True,
  argv=["npm", "run", "db:migrate:rollback"],
)
