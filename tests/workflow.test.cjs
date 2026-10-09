/** Load compiled production code. */
function controller(name) {
  return require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers', `${name}.js`));
}

/** Provide isolated storage through the same interface as the browser. */
function storage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}

require('node:test')('teacher tasks contain only the assignment and accept legacy records', () => {
  const assert = require('node:assert/strict');
  const { TaskController } = controller('TaskController');
  const store = storage();
  store.setItem('tasks', JSON.stringify([{ id: 'old', title: 'Телефон', description: 'Условие', template: 'DD', variables: [], type: 'phone' }]));
  assert.deepEqual(TaskController.getTasks(store), [{ id: 'old', title: 'Телефон', description: 'Условие' }]);
  TaskController.saveTask({ id: 'new', title: 'Адрес', description: 'Создайте шаблон' }, store);
  assert.equal(TaskController.getTasks(store).length, 2);
  assert.equal(JSON.parse(store.getItem('tasks'))[0].template, undefined);
});

require('node:test')('template loads into the stack before any word matching', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const simulation = new SimulationController({ template: 'DAD', terminals: [], variables: [{ symbol: 'D', allowedValues: '0-9' }, { symbol: 'A', allowedValues: '{+}' }] });
  simulation.start('1+2');
  assert.equal(simulation.getState().status, 'loading');
  simulation.tick();
  assert.equal(simulation.getState().inputIndex, 0);
  simulation.loadNext();
  assert.deepEqual(simulation.getState().stack, ['D', 'Z0']);
  simulation.loadNext();
  simulation.loadNext();
  assert.deepEqual(simulation.getState().stack, ['D', 'A', 'D', 'Z0']);
  assert.equal(simulation.getState().inputRemaining, '1+2');
  assert.equal(simulation.getState().status, 'running');
  assert.equal(simulation.getState().currentStateIndex, 2);
  assert.deepEqual(simulation.getState().logs.slice(-2), ['магазин заполнен', '(q1, ε, D) → (q2, 1, D)']);
  simulation.tick();
  assert.equal(simulation.getState().inputIndex, 1);
  assert.equal(simulation.getState().templateIndex, 1);
  assert.deepEqual(simulation.getState().stack, ['A', 'D', 'Z0']);
  simulation.tick();
  simulation.tick();
  assert.equal(simulation.getState().status, 'success');
  const snapshot = simulation.getState();
  snapshot.stack.push('corruption');
  snapshot.logs.push('corruption');
  assert.deepEqual(simulation.getState().stack, ['Z0']);
  assert.ok(!simulation.getState().logs.includes('corruption'));
});

require('node:test')('matching detects wrong symbols and both length mismatches', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  for (const word of ['b', 'aaa', '']) {
    const simulation = new SimulationController({ template: 'aa', terminals: [], variables: [] });
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().status, 'error', word);
  }
});

require('node:test')('student grammar validates symbols, literal sets, spaces and ranges', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'D', allowedValues: '{0-9}' }, { symbol: 'P', allowedValues: '{+}' }], 'DLPD');
  assert.deepEqual(grammar.terminals, []);
  assert.equal(GrammarController.validate(grammar), '');
  for (const allowed of ['.', '+', '[', '*', '(', '\\']) {
    assert.equal(GrammarController.matches(allowed, allowed), true);
    assert.equal(GrammarController.matches('a', allowed), false);
  }
  assert.equal(GrammarController.matches('л', 'а-я, ё'), true);
  assert.equal(GrammarController.matches('ё', 'а-я, ё'), true);
  assert.equal(GrammarController.matches('Л', 'а-я'), false);
  assert.equal(GrammarController.matches('Б', 'а-яА-Я'), true);
  assert.equal(GrammarController.matches('к', 'а-яА-Я'), true);
  assert.equal(GrammarController.validate({ template: 'Ж, office.', terminals: [], variables: [] }), '');
  assert.notEqual(GrammarController.validate({ template: 'D', terminals: ['1'], variables: [{ symbol: 'D', allowedValues: '9-0' }] }), '');
  assert.notEqual(GrammarController.validate({ template: 'Д', terminals: [], variables: [{ symbol: 'Д', allowedValues: 'D' }] }), '');
  assert.notEqual(GrammarController.validate({ template: 'D', terminals: ['1'], variables: [{ symbol: 'D', allowedValues: '1' }, { symbol: 'D', allowedValues: '2' }] }), '');
});

require('node:test')('student session is normalized and malformed sessions are ignored', () => {
  const assert = require('node:assert/strict');
  const { AuthController } = controller('AuthController');
  const store = storage();
  AuthController.registerStudent({ fio: ' Иванов ', group: ' 301 ' }, store);
  assert.equal(AuthController.getCurrentStudent(store).fio, 'Иванов');
  assert.equal(AuthController.getCurrentStudent(store).group, '301');
  AuthController.logout(store);
  assert.equal(AuthController.getCurrentStudent(store), null);
  store.setItem('current_student', '{broken');
  assert.equal(AuthController.getCurrentStudent(store), null);
});

require('node:test')('simulation preserves spaces and unicode symbols', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const simulation = new SimulationController({ template: 'LSD', terminals: [], variables: [{ symbol: 'D', allowedValues: '{0-9}' }, { symbol: 'S', allowedValues: '{␣}' }] });
  simulation.start('🙂 7');
  while (simulation.getState().status === 'loading') simulation.loadNext();
  while (simulation.getState().status === 'running') simulation.tick();
  assert.equal(simulation.getState().status, 'success');
  assert.equal(simulation.getState().inputIndex, 3);
});

require('node:test')('results retain the assignment, student grammar and group after deletion', () => {
  const assert = require('node:assert/strict');
  const { ResultController } = controller('ResultController');
  const { TaskController } = controller('TaskController');
  const store = storage();
  TaskController.saveTask({ id: 'task', title: 'Телефон', description: 'Постройте шаблон' }, store);
  const result = { id: 'attempt', studentId: 'student', studentName: 'Иванов', studentGroup: 'ИВТ-301', taskId: 'task', taskTitle: 'Телефон', taskDescription: 'Постройте шаблон', status: 'success', score: 5, inputWord: '12', logs: [], completedAt: '2026-10-08T10:00:00Z', solution: { template: 'DD', terminals: ['1', '2'], variables: [{ symbol: 'D', allowedValues: '0-9' }] } };
  ResultController.saveResult(result, store);
  TaskController.deleteTask('task', store);
  assert.deepEqual(ResultController.getResults(store), [result]);
  ResultController.saveResult(result, store);
  assert.equal(ResultController.getResults(store).length, 1);
});

require('node:test')('theme is persisted and falls back safely', () => {
  const assert = require('node:assert/strict');
  const { AppearanceController } = controller('AppearanceController');
  const store = storage();
  assert.equal(AppearanceController.getTheme(store), 'dark');
  AppearanceController.saveTheme('light', store);
  assert.equal(AppearanceController.getTheme(store), 'light');
  assert.equal(AppearanceController.getTheme({ getItem() { throw Error('unavailable'); } }), 'dark');
});

require('node:test')('group and assignment filters combine and retain old attempts', () => {
  const assert = require('node:assert/strict');
  const { ResultController } = controller('ResultController');
  const results = [{ id: 'a', taskId: 'one', studentGroup: '301' }, { id: 'b', taskId: 'two', studentGroup: '301' }, { id: 'c', taskId: 'one', studentGroup: '302' }, { id: 'old', taskId: 'one' }];
  assert.deepEqual(ResultController.filterResults(results, 'one', '301').map(item => item.id), ['a']);
  assert.deepEqual(ResultController.filterResults(results, 'one', 'Группа не указана').map(item => item.id), ['old']);
  assert.equal(ResultController.filterResults(results, '', '').length, 4);
});

require('node:test')('reserved L accepts any single input symbol without a manual alphabet', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const { GrammarController } = controller('GrammarController');
  const grammar = { template: 'L', terminals: [], variables: [] };
  assert.equal(GrammarController.validate(grammar), '');
  assert.notEqual(GrammarController.validate({ ...grammar, terminals: ['a'], variables: [{ symbol: 'L', allowedValues: 'a' }] }), '');
  for (const char of Array.from('LЖёQ7_ ,.+-()[]{}\\🙂')) {
    const simulation = new SimulationController(grammar);
    simulation.start(char);
    simulation.loadNext();
    simulation.tick();
    assert.equal(simulation.getState().status, 'success', char);
    assert.equal(simulation.getState().inputIndex, 1, 'L still matches one character before input validation completes');
  }
  const simulation = new SimulationController(grammar);
  simulation.start('ab');
  simulation.loadNext();
  simulation.tick();
  simulation.tick();
  assert.equal(simulation.getState().status, 'error', 'L matches one symbol, not an entire word');
});

require('node:test')('universal L does not widen user-defined nonterminals or literal terminals', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  for (const [word, expected] of [['Ж7', 'success'], ['Жa', 'error']]) {
    const simulation = new SimulationController({ template: 'LD', terminals: ['7'], variables: [{ symbol: 'D', allowedValues: '0-9' }] });
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().status, expected);
  }
});

require('node:test')('logs mark the filled stack and start matching in q2', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const simulation = new SimulationController({ template: 'DS', terminals: [], variables: [{ symbol: 'D', allowedValues: '{0-9}' }, { symbol: 'S', allowedValues: '{!}' }] });
  simulation.start('7!');
  assert.deepEqual(simulation.getState().logs, []);
  simulation.loadNext();
  simulation.loadNext();
  simulation.tick();
  simulation.tick();
  assert.deepEqual(simulation.getState().logs, [
    '(q0, ε, Z0) → (q1, ε, S)',
    '(q1, ε, S) → (q1, ε, D)',
    'магазин заполнен',
    '(q1, ε, D) → (q2, 7, D)',
    '(q2, 7, D) → (q3, !, S)',
    '(q3, !, S) → (q4, ε, Z0)',
    '(q4, ε, Z0) → (qf, ε, Z0)',
  ]);
  simulation.start('a!');
  simulation.loadNext();
  simulation.loadNext();
  simulation.tick();
  assert.equal(simulation.getState().logs.at(-1), '(q2, a, D) → (qERR, a, D)');
  assert.notEqual(simulation.getState().errorMessage, '');
  for (const [word, transition] of [
    ['7', '(q3, ε, S) → (qERR, ε, S)'],
    ['7!!', '(q4, !, Z0) → (qERR, !, Z0)'],
  ]) {
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().logs.at(-1), transition);
  }
});

require('node:test')('joined and separated braced sets describe the same alphabet including underscore', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  for (const values of ['{а-яБ-Я_}', '{а-я, Б-Я, _}', '{а-я; Б-Я; _}', '{а-я Б-Я _}', 'а-яБ-Я_']) {
    const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: values }], 'B');
    assert.equal(GrammarController.validate(grammar), '', values);
    for (const char of ['а', 'к', 'я', 'Б', 'К', 'Я', '_']) assert.equal(GrammarController.matches(char, values), true, `${values}: ${char}`);
    for (const char of ['А', 'ё', 'Ё', '{', '}', ',', ';', '7', 'a']) assert.equal(GrammarController.matches(char, values), false, `${values}: ${char}`);
  }
  assert.equal(GrammarController.matches(' ', '{а-я Б-Я _}'), true);
  assert.equal(GrammarController.matches(' ', '{а-яБ-Я_}'), false);
  for (const values of ['{}', '{а-я', 'а-я}', '{я-а}', '{а-я{_}}']) {
    assert.notEqual(GrammarController.validate(GrammarController.createGrammar([{ symbol: 'B', allowedValues: values }], 'B')), '', values);
  }
  assert.equal(GrammarController.matches(',', '{а-я\\,_}'), true);
  assert.equal(GrammarController.matches('{', '{\\{\\}}'), true);
  assert.equal(GrammarController.matches('}', '{\\{\\}}'), true);
});

require('node:test')('qERR explains the offending symbol and preserves the failed configuration', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  for (const [word, symbol, position, transition, stack, index] of [
    ['а', 'б', 2, '(q3, ε, б) → (qERR, ε, б)', ['б', 'Z0'], 1],
    ['', 'а', 1, '(q2, ε, а) → (qERR, ε, а)', ['а', 'б', 'Z0'], 0],
    ['абв', 'в', 3, '(q4, в, Z0) → (qERR, в, Z0)', ['Z0'], 2],
    ['ав', 'б', 2, '(q3, в, б) → (qERR, в, б)', ['б', 'Z0'], 1],
  ]) {
    const simulation = new SimulationController({ template: 'аб', terminals: [], variables: [] });
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    const state = simulation.getState();
    assert.equal(state.logs.at(-1), transition);
    assert.deepEqual(state.stack, stack);
    assert.equal(state.inputIndex, index);
    assert.equal(state.templateIndex, index);
    assert.ok(state.errorMessage.includes(`«${symbol}»`));
    assert.ok(state.errorMessage.includes(`позиция ${position}`));
    assert.equal(state.errors.length, 0, 'comparison is a result, not an input mistake');
    assert.deepEqual(simulation.tick(), state, 'terminal error cannot consume the remaining symbol');
  }
});

require('node:test')('literal template text and underscore consume input normally', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  for (const [template, variables, word, expected] of [
    ['abZ', [], 'abZ', 'success'],
    ['абЖ', [], 'абЖ', 'success'],
    ['abZ', [], 'abЖ', 'error'],
    ['BBB', [{ symbol: 'B', allowedValues: '{а-яБ-Я_}' }], 'кБ_', 'success'],
    ['BBB', [{ symbol: 'B', allowedValues: '{а-яБ-Я_}' }], 'кБ', 'error'],
    ['B', [{ symbol: 'B', allowedValues: '{_}' }], '', 'error'],
  ]) {
    const simulation = new SimulationController(GrammarController.createGrammar(variables, template));
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().status, expected, word);
  }
  assert.equal(GrammarController.validate(GrammarController.createGrammar([], '_')), '');
});

require('node:test')('street templates match Russian text and report English input independently of literal matching', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  for (const suffix of ['офис', 'office']) {
    const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а-яА-ЯёЁ}' }, { symbol: 'D', allowedValues: '{0-9}' }], `ул. BBBB, д. DD, кв. DD (${suffix})`);
    assert.equal(GrammarController.validate(grammar), '');
    assert.ok(grammar.terminals.includes(','));
    assert.ok(grammar.terminals.includes('у'));
    const simulation = new SimulationController(grammar);
    const word = `ул. Мира, д. 12, кв. 34 (${suffix})`;
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().inputIndex, Array.from(word).length);
    assert.equal(simulation.getState().status, 'success');
    assert.equal(simulation.getState().errors.length, 0);
  }
});

require('node:test')('matching keeps reasons separate from counted input mistakes and result snapshots', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  const { ResultController } = controller('ResultController');
  const store = storage();
  const grammar = GrammarController.createGrammar([{ symbol: 'Б', allowedValues: '{а-я}' }, { symbol: 'D', allowedValues: '{a-z}' }], 'БD');
  const simulation = new SimulationController(grammar);
  simulation.start('Ба');
  assert.equal(simulation.getState().status, 'loading');
  assert.deepEqual(simulation.getState().errors, []);
  simulation.loadNext();
  simulation.loadNext();
  assert.deepEqual(simulation.getState().errors, []);
  simulation.tick();
  assert.equal(simulation.getState().status, 'running');
  simulation.tick();
  const state = simulation.getState();
  assert.equal(state.status, 'error');
  assert.deepEqual(state.errors, []);
  assert.match(state.errorMessage, /не соответствует/);
  const result = ResultController.createResult({ id: 'attempt', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 'task', title: 'Адрес', description: 'Условие' }, solution: grammar, state, completedAt: '2026-10-08T10:00:00Z' });
  ResultController.saveResult(result, store);
  assert.deepEqual(ResultController.getResults(store)[0].errors, state.errors);
  state.errors.push('external mutation');
  assert.equal(result.errors.length, 0);
  assert.equal(result.score, 100);
  assert.equal(simulation.getState().errors.length, 0);
});

require('node:test')('matching itself does not grade invalid alphabet settings', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  for (const [variables, template, word] of [
    [[{ symbol: 'D', allowedValues: '{a-z}' }], 'D', 'a'],
    [[{ symbol: 'Б', allowedValues: '{Б}' }], 'Б', 'Б'],
    [[{ symbol: 'b', allowedValues: '{_}' }], 'b', 'b'],
    [[], '', ''],
  ]) {
    const grammar = GrammarController.createGrammar(variables, template);
    assert.notEqual(GrammarController.validate(grammar), '');
    const simulation = new SimulationController(grammar);
    simulation.start(word);
    assert.deepEqual(simulation.getState().errors, []);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    assert.equal(simulation.getState().status, 'success');
    assert.deepEqual(simulation.getState().errors, []);
  }
});

require('node:test')('English terminal letters are forbidden in literals, ranges and malformed sets', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  for (const values of ['a', '{a-z}', '{A-Z}', '{Яa}', '{9-~}', '{z-a}', '{a']) {
    const errors = GrammarController.validateTerminalSet(values);
    assert.ok(errors.some(error => /английские буквы/.test(error)), values);
  }
  assert.deepEqual(GrammarController.validateTerminalSet('{а-яА-Я_0-9␣}'), []);
});

require('node:test')('a corrected retry succeeds without erasing the failed result or its counted errors', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  const { ResultController } = controller('ResultController');
  const store = storage();
  const results = [];
  for (const [id, values, expected] of [['failed', '{a-z}', 'error'], ['corrected', '{а-я}', 'success']]) {
    const solution = GrammarController.createGrammar([{ symbol: 'B', allowedValues: values }], 'BB');
    const simulation = new SimulationController(solution);
    simulation.start('да');
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    const state = simulation.getState();
    assert.equal(state.status, expected);
    const result = ResultController.createResult({ id, student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 'task', title: 'Слово', description: 'Условие' }, solution, state, inputErrors: GrammarController.validateAlphabet(solution), completedAt: '2026-10-08T10:00:00Z' });
    ResultController.saveResult(result, store);
    results.push(result);
  }
  assert.equal(results[0].score, 95);
  assert.equal(results[0].errors.length, 1);
  assert.match(results[0].errors[0], /английские буквы/);
  assert.equal(results[1].score, 100);
  assert.deepEqual(results[1].errors, []);
  assert.deepEqual(ResultController.getResults(store), [...results].reverse());
});

require('node:test')('alphabet mistakes reach the teacher while English word matching adds no penalty', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  const { ResultController } = controller('ResultController');
  const solution = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{a-z}' }], 'LBL');
  const simulation = new SimulationController(solution);
  simulation.start('🙂aZ');
  assert.deepEqual(simulation.getState().errors, []);
  while (simulation.getState().status === 'loading') simulation.loadNext();
  assert.deepEqual(simulation.getState().errors, []);
  while (simulation.getState().status === 'running') simulation.tick();
  const state = simulation.getState();
  assert.equal(state.status, 'success');
  assert.equal(state.inputIndex, 3, 'all symbols matched, but validation errors make the attempt fail');
  assert.deepEqual(state.errors, []);
  const inputErrors = GrammarController.validateAlphabet(solution);
  assert.equal(inputErrors.length, 1);
  assert.equal(inputErrors[0].kind, 'invalid_terminal');
  const result = ResultController.createResult({ id: 'attempt', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 'task', title: 'Слово', description: 'Условие' }, solution, state, inputErrors, completedAt: '2026-10-08T10:00:00Z' });
  assert.equal(result.errors.length, 1);
  assert.equal(result.score, 95);
  simulation.start('🙂я7');
  while (simulation.getState().status === 'loading') simulation.loadNext();
  while (simulation.getState().status === 'running') simulation.tick();
  assert.ok(!simulation.getState().errors.some(error => /Ошибка входного слова/.test(error)), 'new submission must discard old input validation errors');
});

require('node:test')('input stage sums nonterminal and terminal mistakes while comparison counts none', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const { GrammarController } = controller('GrammarController');
  const grammar = { template: 'а', terminals: [], variables: [{ symbol: 'Б', allowedValues: '{a}' }] };
  const simulation = new SimulationController(grammar);
  simulation.start('z');
  simulation.loadNext();
  simulation.tick();
  assert.deepEqual(simulation.getState().errors, []);
  const errors = GrammarController.validateAlphabet(grammar);
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.kind === 'invalid_nonterminal'));
  assert.ok(errors.some(error => error.kind === 'invalid_terminal'));
});

require('node:test')('Next blocks invalid preparation and retains its errors after all fields are corrected', () => {
  const assert = require('node:assert/strict');
  const { PreparationController } = controller('PreparationController');
  const { GrammarController } = controller('GrammarController');
  const { ResultController } = controller('ResultController');
  const preparation = new PreparationController();
  const blocked = preparation.submit(GrammarController.createGrammar([{ symbol: 'Б', allowedValues: '{a-z}' }], 'Б'), 'a');
  assert.equal(blocked.ready, false);
  assert.equal(blocked.controller, undefined, 'invalid submission cannot create or load a simulation');
  assert.equal(blocked.errors.length, 2);
  assert.equal(blocked.errorCount, 2);
  assert.ok(blocked.errors.some(error => /заглавной английской/.test(error)));
  assert.ok(blocked.errors.some(error => /Терминальное множество/.test(error)));
  const accepted = preparation.submit(GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а-я}' }], 'B'), 'я');
  assert.equal(accepted.ready, true);
  assert.equal(accepted.state.status, 'loading');
  assert.deepEqual(accepted.state.errors, [], 'historical errors belong to the final report');
  accepted.controller.loadNext();
  const completed = accepted.controller.tick();
  assert.equal(completed.inputIndex, 1);
  assert.equal(completed.status, 'success');
  assert.deepEqual(completed.errors, []);
  assert.equal(accepted.inputErrors.length, 2);
  assert.ok(accepted.inputErrors.some(error => /«Б»/.test(error.message)), 'report retains the original wrong symbol');
  const result = ResultController.createResult({ id: 'attempt', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 'task', title: 'Слово', description: 'Условие' }, solution: accepted.grammar, state: completed, inputErrors: accepted.inputErrors, completedAt: '2026-10-08T10:00:00Z' });
  assert.equal(result.errors.length, 2);
  assert.equal(result.score, 90);
  assert.equal(result.solution.variables[0].symbol, 'B', 'saved solution contains corrected data and report contains earlier mistakes');
});

require('node:test')('each blocked Next sums errors without losing earlier submissions or counting matching errors before loading', () => {
  const assert = require('node:assert/strict');
  const { PreparationController } = controller('PreparationController');
  const { GrammarController } = controller('GrammarController');
  const preparation = new PreparationController();
  const bad = GrammarController.createGrammar([{ symbol: 'Б', allowedValues: '{a}' }], 'а');
  const first = preparation.submit(bad, 'а');
  assert.equal(first.errorCount, 2);
  first.errors.push('external mutation');
  const second = preparation.submit(bad, 'а');
  assert.equal(second.errorCount, 4);
  assert.equal(second.errors.length, 2);
  const next = preparation.submit(GrammarController.createGrammar([], 'а'), 'б');
  assert.equal(next.ready, true, 'valid settings permit matching even if the word will not match');
  next.controller.loadNext();
  const completed = next.controller.tick();
  assert.deepEqual(completed.errors, []);
  assert.equal(next.inputErrors.length, 4);
  assert.match(completed.errorMessage, /не соответствует/);
  assert.ok(!next.inputErrors.some(error => error.message === 'external mutation'));
});

require('node:test')('new preparation after a completed result starts a separate history', () => {
  const assert = require('node:assert/strict');
  const { PreparationController } = controller('PreparationController');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([], 'я');
  const preparation = new PreparationController();
  assert.equal(preparation.submit(GrammarController.createGrammar([{ symbol: 'Б', allowedValues: '{я}' }], 'я'), 'я').ready, false);
  const first = preparation.submit(grammar, 'я');
  first.controller.loadNext();
  const oldReport = first.controller.tick();
  assert.equal(first.inputErrors.length, 1);
  assert.deepEqual(oldReport.errors, []);
  const retry = new PreparationController().submit(grammar, 'я');
  retry.controller.loadNext();
  const clean = retry.controller.tick();
  assert.equal(clean.status, 'success');
  assert.deepEqual(clean.errors, []);
  assert.equal(first.inputErrors.length, 1);
});
