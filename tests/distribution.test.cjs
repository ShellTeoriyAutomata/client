/** Supply independent persistent storage for assignment distribution tests. */
function storage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}

/** Load the same task controller used in the application. */
function taskController() {
  return require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers/TaskController.js')).TaskController;
}

require('node:test')('a new profile receives configured assignments from the actual build defaults', () => {
  const assert = require('node:assert/strict');
  const controller = taskController();
  const store = storage();
  const expected = require('../src/data/default-tasks.json');
  assert.deepEqual(controller.getTasks(store), expected);
  assert.deepEqual(JSON.parse(store.getItem('tasks')), expected);
  assert.deepEqual(controller.getTasks(store), expected);
  const local = storage();
  local.setItem('tasks', JSON.stringify([{ id: 'my-address', title: 'Мой адрес', description: 'Моё сохранённое условие' }]));
  assert.deepEqual(controller.getTasks(local), [{ id: 'my-address', title: 'Мой адрес', description: 'Моё сохранённое условие' }]);
});

require('node:test')('bundled tasks are persisted once and local changes survive restart', () => {
  const assert = require('node:assert/strict');
  const controller = taskController();
  const store = storage();
  const defaults = [{ id: 'phone', title: 'Телефон', description: 'Создайте шаблон телефона.\nСохраните описание.' }];
  assert.deepEqual(controller.getTasks(store, defaults), defaults);
  assert.deepEqual(JSON.parse(store.getItem('tasks')), defaults);
  controller.saveTask({ id: 'custom', title: 'Адрес', description: 'Своё задание' }, store);
  assert.equal(controller.getTasks(store, [{ id: 'updated', title: 'Новая сборка', description: 'Другое условие' }]).length, 2);
  controller.deleteTask('phone', store);
  controller.deleteTask('custom', store);
  assert.deepEqual(controller.getTasks(store, defaults), []);
});

require('node:test')('existing or damaged storage is never replaced by bundled assignments', () => {
  const assert = require('node:assert/strict');
  const controller = taskController();
  for (const value of ['[]', 'broken json', '{}']) {
    const store = storage();
    store.setItem('tasks', value);
    assert.deepEqual(controller.getTasks(store, [{ id: 'seed', title: 'Название', description: 'Описание' }]), []);
    assert.equal(store.getItem('tasks'), value);
  }
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.deepEqual(controller.getTasks(blocked), []);
  const readonly = { getItem: () => null, setItem() { throw new Error('full'); }, removeItem() {} };
  assert.deepEqual(controller.getTasks(readonly, [{ id: 'seed', title: 'Название', description: 'Описание' }]), []);
});

require('node:test')('assignment export contains only titles, descriptions and stable ids', () => {
  const assert = require('node:assert/strict');
  const controller = taskController();
  const store = storage();
  store.setItem('tasks', JSON.stringify([{ id: 'one', title: 'Текущее задание', description: 'Условие\nВторая строка', template: 'SECRET' }]));
  store.setItem('results', '[{"student":"PRIVATE"}]');
  const downloads = [];
  controller.exportTasks({ saveFile: (...args) => downloads.push(args) }, store);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0][0], 'default-tasks.json');
  assert.deepEqual(JSON.parse(downloads[0][1]), [{ id: 'one', title: 'Текущее задание', description: 'Условие\nВторая строка' }]);
  assert.equal(downloads[0][2], 'application/json');
  assert.doesNotMatch(downloads[0][1], /PRIVATE|SECRET/);
});

require('node:test')('bundling validates the complete export before replacing defaults', () => {
  const assert = require('node:assert/strict');
  const { bundleTaskFile } = require('../scripts/bundle-tasks.cjs');
  const assignment = { id: 'one', title: 'Телефон', description: 'Описание\nВторая строка', template: 'ignored' };
  const writes = [];
  const files = { readFile: () => '\uFEFF' + JSON.stringify([assignment]), writeFile: (...args) => writes.push(args) };
  assert.equal(bundleTaskFile('download.json', 'defaults.json', files), 1);
  assert.deepEqual(JSON.parse(writes[0][1]), [{ id: 'one', title: 'Телефон', description: 'Описание\nВторая строка' }]);
  for (const input of ['{', '{}', '[null]', '[{"id":"one","title":" ","description":"x"}]', JSON.stringify([assignment, assignment])]) {
    assert.throws(() => bundleTaskFile('download.json', 'defaults.json', { ...files, readFile: () => input }));
  }
  assert.equal(writes.length, 1);
  assert.equal(bundleTaskFile('download.json', 'defaults.json', { ...files, readFile: () => '[]' }), 0);
});

require('node:test')('Windows installer config is valid without invoking packaging', () => {
  const assert = require('node:assert/strict');
  const config = require('../package.json');
  assert.match(config.scripts['electron:pack:win'], /npm test.*npm run build.*electron-builder --win nsis --x64 --publish never/);
  assert.match(config.scripts['tasks:bundle'], /node scripts\/bundle-tasks\.cjs/);
  assert.deepEqual(config.build.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(config.build.nsis.artifactName, '${productName}-Setup-${version}.${ext}');
  assert.equal(config.build.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.build.nsis.oneClick, false);
  assert.equal(config.build.nsis.allowToChangeInstallationDirectory, true);
  const validate = require('@develar/schema-utils');
  validate(require('app-builder-lib/scheme.json'), config.build, { name: 'electron-builder' });
});

require('node:test')('bundling CLI resolves paths with spaces and writes into its project directory', () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'automata-bundle-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
    const script = path.join(root, 'scripts/bundle-tasks.cjs');
    fs.copyFileSync(path.join(__dirname, '../scripts/bundle-tasks.cjs'), script);
    const source = path.join(root, 'current assignment.json');
    const tasks = [{ id: 'first', title: 'Текущее задание', description: 'Описание\nВторая строка' }];
    fs.writeFileSync(source, JSON.stringify(tasks), 'utf8');
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, [script, source], { cwd: require('node:os').tmpdir(), stdio: 'inherit' });
    assert.equal(result.status, 0);
    const defaults = path.join(root, 'src/data/default-tasks.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(defaults, 'utf8')), tasks);
    fs.writeFileSync(source, 'invalid', 'utf8');
    const rejected = spawnSync(process.execPath, [script, source], { stdio: 'inherit' });
    assert.equal(rejected.status, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(defaults, 'utf8')), tasks);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
