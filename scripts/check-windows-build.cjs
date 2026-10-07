/**
 * Интерфейс окружения сборки; проверка не зависит от конкретного способа запуска процессов.
 * @typedef {Object} BuildEnvironment
 * @property {string} platform ОС сборочного компьютера.
 * @property {() => boolean} hasWine Проверка доступности Wine.
 * @property {(message: string) => void} reportError Вывод причины остановки.
 */

/**
 * Проверяет наличие Wine перед сборкой Windows EXE на Linux.
 * @param {BuildEnvironment} environment Окружение сборочного компьютера.
 * @returns {boolean} Можно ли продолжить сборку.
 */
function checkWindowsBuild(environment) {
  if (environment.platform !== 'linux' || environment.hasWine()) return true;
  environment.reportError(
    'Для создания Windows EXE на Linux требуется Wine.\n' +
    'Для просмотра и отладки приложения запустите: npm run dev\n' +
    'Затем откройте http://localhost:5173/ (точный адрес напечатает Vite).\n' +
    'Установщик можно собрать позже на Windows: npm run electron:pack:win'
  );
  return false;
}

module.exports = { checkWindowsBuild };

if (require.main === module) {
  const { spawnSync } = require('node:child_process');
  if (!checkWindowsBuild({
    platform: process.platform,
    hasWine: () => spawnSync('wine', ['--version'], { stdio: 'ignore', timeout: 5000 }).status === 0,
    reportError: message => console.error(message),
  })) process.exitCode = 1;
}
