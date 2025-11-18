import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Node version alignment', () => {
  it('should have @types/node version matching the minimum supported Node version', () => {
    // Read package.json
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Read tsconfig.json to determine minimum Node version
    const tsconfigPath = join(__dirname, '..', 'tsconfig.json');
    // Remove trailing commas to make it valid JSON
    const tsconfigContent = readFileSync(tsconfigPath, 'utf-8').replace(
      /,(\s*[}\]])/g,
      '$1',
    );
    const tsconfig = JSON.parse(tsconfigContent);

    // Extract Node version from @tsconfig/nodeXX reference
    const nodeConfigExtends = tsconfig.extends?.find((ext: string) =>
      ext.includes('@tsconfig/node'),
    );

    expect(nodeConfigExtends).toBeDefined();

    // Extract Node major version from the tsconfig extends (e.g., "@tsconfig/node18" -> "18")
    const nodeVersionMatch = nodeConfigExtends?.match(
      /@tsconfig\/node(\d+)/,
    );
    expect(nodeVersionMatch).toBeDefined();

    const expectedNodeMajorVersion = nodeVersionMatch![1];

    // Check @types/node version
    const typesNodeVersion = packageJson.devDependencies['@types/node'];
    expect(typesNodeVersion).toBeDefined();

    // The @types/node version should start with ^{nodeVersion}.
    // For example, if using @tsconfig/node18, @types/node should be ^18.x.x
    expect(
      typesNodeVersion.startsWith(`^${expectedNodeMajorVersion}.`) ||
        typesNodeVersion.startsWith(`~${expectedNodeMajorVersion}.`),
    ).toBe(true);
  });
});
