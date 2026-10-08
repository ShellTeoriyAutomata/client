/**
 * @typedef {Object} TaskBundleFilePort
 * @property {(filename: string) => string} readFile Read UTF-8 text.
 * @property {(filename: string, contents: string) => void} writeFile Write UTF-8 text.
 */

/**
 * Validate a complete assignment export and copy it into the build defaults.
 * @param {string} sourcePath Exported JSON filename.
 * @param {string} targetPath Bundled defaults filename.
 * @param {TaskBundleFilePort} files Filesystem boundary.
 * @returns {number} Number of bundled assignments.
 */
function bundleTaskFile(sourcePath, targetPath, files) {
  const parsed = JSON.parse(files.readFile(sourcePath).replace(/^\uFEFF/, ''));
  if (!Array.isArray(parsed)) throw new Error('Файл должен содержать массив заданий.');
  const ids = new Set();
  const tasks = parsed.map((task, index) => {
    if (task === null || typeof task !== 'object' ||
      typeof task.id !== 'string' || !task.id.trim() ||
      typeof task.title !== 'string' || !task.title.trim() ||
      typeof task.description !== 'string' || !task.description.trim()) {
      throw new Error(`Задание ${index + 1}: нужны непустые строки id, title и description.`);
    }
    if (ids.has(task.id)) throw new Error(`Повторный id задания: ${task.id}`);
    ids.add(task.id);
    return { id: task.id, title: task.title, description: task.description };
  });
  files.writeFile(targetPath, JSON.stringify(tasks, null, 2) + '\n');
  return tasks.length;
}

/** Run the explicit bundling command; importing this module never modifies files. */
function run() {
  try {
    const sourcePath = process.argv[2];
    if (!sourcePath || process.argv.length !== 3) {
      throw new Error('Использование: npm run tasks:bundle -- "путь/к/default-tasks.json"');
    }
    const fs = require('node:fs');
    const path = require('node:path');
    const count = bundleTaskFile(path.resolve(sourcePath), path.join(__dirname, '../src/data/default-tasks.json'), {
      readFile: filename => fs.readFileSync(filename, 'utf8'),
      writeFile: (filename, contents) => fs.writeFileSync(filename, contents, 'utf8'),
    });
    console.log(`В сборку включено заданий: ${count}. Теперь выполните npm run electron:pack:win.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { bundleTaskFile };
if (require.main === module) run();
