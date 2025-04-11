load('ext://pulumi', 'pulumi_resource')
load('ext://uibutton', 'cmd_button', 'location')
update_settings(k8s_upsert_timeout_secs=300)

docker_build(
  'api-image',
  context='.',
  dockerfile='./Dockerfile.dev',
  ignore=['./node_modules', './.infra', '__tests__', './seeds', './build'],
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
  deps=['.infra/index.ts', '.infra/workers.ts', '.infra/.env'],
  image_deps=['api-image'],
  image_configs=['image'],
)

# Add a button to API to run pulumi up
cmd_button(
  name="pulumi_up",
  resource="api",
  text="Run pulumi up",
  icon_name="arrow_circle_up",
  requires_confirmation=True,
  dir="./.infra",
  argv=["pulumi", "up", "--stack", "adhoc", "--yes", "--skip-preview"],
)
