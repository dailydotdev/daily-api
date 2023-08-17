load('ext://pulumi', 'pulumi_resource')
update_settings(k8s_upsert_timeout_secs=300)

docker_build(
  'api-image',
  context='.',
  dockerfile='./Dockerfile.dev',
  ignore=['./node_modules', './.infra', '__tests__'],
  live_update=[
    sync('./src', '/opt/app/src'),
    sync('./bin', '/opt/app/bin'),
    run(
      'npm i',
      trigger=['./package.json', './package-lock.json']
    )
  ])

pulumi_resource(
  'api',
  stack='adhoc',
  dir='.infra/',
  deps=['.infra/index.ts', '.infra/workers.ts'],
  image_deps=['api-image'],
  image_configs=['image'],
)
