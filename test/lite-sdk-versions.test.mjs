import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const litePages = [
  ['dashmint-lab', 'dashmint-lite.html'],
  ['dashnote', 'dashnote-lite.html'],
  ['dashrate', 'dashrate-lite.html'],
  ['dashproof-lab', 'dashproof-lite.html'],
];

describe('Standalone lite SDK versions', () => {
  for (const [appName, pageName] of litePages) {
    it(`${appName} matches its companion app`, () => {
      const appDirectory = new URL(
        `../example-apps/${appName}/`,
        import.meta.url,
      );
      const packageJson = JSON.parse(
        readFileSync(new URL('package.json', appDirectory), 'utf8'),
      );
      const page = readFileSync(
        new URL(`public/${pageName}`, appDirectory),
        'utf8',
      );
      const expectedImport =
        `https://esm.sh/@dashevo/evo-sdk@` +
        packageJson.dependencies['@dashevo/evo-sdk'];
      const sdkImports = [
        ...page.matchAll(
          /from\s+['"](https:\/\/esm\.sh\/@dashevo\/evo-sdk@[^'"]+)['"]/g,
        ),
      ].map((match) => match[1]);

      assert.deepEqual(
        sdkImports,
        [expectedImport],
        `${pageName} must import exactly the SDK version from ${appName}/package.json`,
      );
    });
  }
});
