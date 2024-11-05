import fs from 'fs/promises';
import path from 'path';

type Stack = {
  deployment: {
    resources: {
      urn: string;
      type: string;
    }[];
  };
};

type ResourceMetadata = {
  type: string;
  size: number;
};

function convertToCSV(resources: ResourceMetadata[]): string {
  const header = 'type,size\n';
  const rows = resources.map((x) => `${x.type},${x.size}`);
  return header + rows.join('\n');
}

function getResourceMetadata(
  resource: Stack['deployment']['resources'][0],
): ResourceMetadata {
  return {
    type: resource.type,
    size: JSON.stringify(resource).length,
  };
}

async function run(): Promise<void> {
  const rawStack = await fs.readFile('../.infra/stack.json', 'utf-8');
  const stack = JSON.parse(rawStack) as Stack;
  const resources = stack.deployment.resources.map(getResourceMetadata);
  const csv = convertToCSV(resources);
  await fs.writeFile(path.resolve('../.infra/stack.csv'), csv);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
