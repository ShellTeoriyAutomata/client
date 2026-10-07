import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

it('останавливает Windows-сборку на Linux без Wine с командой локального запуска', async () => {
  const { checkWindowsBuild } = await import('../scripts/check-windows-build.cjs');
  const messages = [];
  assert.equal(checkWindowsBuild({
    platform: 'linux', hasWine: () => false, reportError: message => messages.push(message),
  }), false);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Wine/);
  assert.match(messages[0], /npm run dev/);
  assert.match(messages[0], /http:\/\/localhost:5173/);
});

it('разрешает сборку на Windows без Wine и на Linux с Wine', async () => {
  const { checkWindowsBuild } = await import('../scripts/check-windows-build.cjs');
  assert.equal(checkWindowsBuild({
    platform: 'win32', hasWine: () => assert.fail('На Windows Wine не нужен'),
    reportError: () => assert.fail('Не должно быть ошибки'),
  }), true);
  assert.equal(checkWindowsBuild({
    platform: 'linux', hasWine: () => true, reportError: () => assert.fail('Не должно быть ошибки'),
  }), true);
});

it('создаёт установщик Windows x64 с постоянными ярлыками', async () => {
  const config = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(config.scripts['electron:pack:win'], /--win.*--x64/);
  assert.match(config.scripts['electron:pack:win'], /^node scripts\/check-windows-build\.cjs &&/);
  assert.equal(config.build.win.target, 'nsis');
  assert.equal(config.build.nsis.oneClick, false);
  assert.equal(config.build.nsis.createDesktopShortcut, true);
  assert.equal(config.build.nsis.createStartMenuShortcut, true);
  assert.equal(config.build.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.build.nsis.artifactName, 'Automata-Setup-${version}.exe');
});

it('упакованное приложение открывает локальные файлы без сервера и DevTools', async () => {
  const source = await readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const calls = [];
  const app = {
    isPackaged: true,
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {},
  };
  class BrowserWindow {
    constructor() {
      this.webContents = { openDevTools: () => calls.push('devtools'), on: () => {} };
    }
    loadURL(value) { calls.push(['url', value]); }
    loadFile(value) { calls.push(['file', value]); }
  }
  vm.runInNewContext(source, {
    require: (name) => name === 'electron' ? { app, BrowserWindow } : name === 'path' ? path : {},
    __dirname: '/application/electron',
    process: { env: { NODE_ENV: 'development' }, platform: 'win32' },
    console,
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['file', '/application/dist/index.html']]);
});
