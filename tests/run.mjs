import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

/** Compile the real controllers and run the regression suite without extra dependencies. */
function run() {
  const directory = mkdtempSync(join(tmpdir(), 'automata-tests-'));
  try {
    const controllers = readdirSync('src/controllers').filter(name => name.endsWith('.ts'));
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--outDir', directory,
      '--rootDir', 'src', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node',
      '--skipLibCheck', '--strict', '--jsx', 'react-jsx', '--esModuleInterop',
      'src/App.tsx', ...controllers.map(name => `src/controllers/${name}`)], { stdio: 'inherit' });
    const suite = readdirSync('tests').filter(name => name.endsWith('.test.cjs'));
    for (const name of suite) {
      const result = spawnSync(process.execPath, [`tests/${name}`], {
        stdio: 'inherit', env: { ...process.env, AUTOMATA_TEST_BUILD: directory, NODE_PATH: resolve('node_modules') },
      });
      if (result.status !== 0) process.exitCode = result.status ?? 1;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

run();
