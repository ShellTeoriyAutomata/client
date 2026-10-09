/** Load the compiled production controller. */
function controller(name) {
  return require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers', `${name}.js`));
}

require('node:test')('word symbols outside the terminal alphabet are counted separately and corrections keep their penalties', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { PreparationController } = controller('PreparationController');
  const grammar = GrammarController.createGrammar([], 'L', { terminals: '{а-яЁ0-9 _ε🙂}', nonterminals: '{}' });
  const preparation = new PreparationController();
  assert.deepEqual(GrammarController.validateInputWord('яЁ7 _ε🙂', grammar), []);
  for (const word of ['аa', '!', 'ЖЖ']) {
    const issues = GrammarController.validateInputWord(word, grammar);
    assert.equal(issues.length, word === 'ЖЖ' ? 2 : 1);
    assert.ok(issues.every(issue => issue.kind === 'outside_alphabet' && issue.field === 'input-word'));
    const blocked = preparation.submit(grammar, word);
    assert.equal(blocked.ready, false);
  }
  assert.equal(preparation.getInputErrors().length, 4);
  assert.equal(preparation.getGrade().score, 80);
  const accepted = preparation.submit(grammar, 'я');
  assert.equal(accepted.ready, true);
  assert.equal(accepted.inputErrors.length, 4);
  const narrowed = { ...grammar, alphabet: { ...grammar.alphabet, terminals: '{0-9}' } };
  assert.equal(preparation.submit(narrowed, 'я').ready, false, 'Next rechecks a word after the alphabet changes');
});

require('node:test')('word membership uses terminal set ranges, escaped symbols and expanded references', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{D}' }, { symbol: 'D', allowedValues: '{а-яёЁ}' }], 'L',
    { terminals: '{B0-9_␣🙂\\,}', nonterminals: 'BD' });
  assert.deepEqual(GrammarController.validateAlphabet(grammar), []);
  assert.deepEqual(GrammarController.validateInputWord('яёЁ0 9_🙂,', grammar), []);
  assert.deepEqual(GrammarController.validateInputWord('B!-', grammar).map(issue => issue.kind), ['outside_alphabet', 'outside_alphabet', 'outside_alphabet']);
  assert.equal(GrammarController.validateInputWord('а', { ...grammar, alphabet: { ...grammar.alphabet, terminals: '' } }).length, 1);
  const invalidAlphabet = { ...grammar, alphabet: { ...grammar.alphabet, terminals: '{a}' } };
  assert.deepEqual(GrammarController.validateInputWord('a', invalidAlphabet), [], 'word membership has no separate English-letter rule');
  assert.ok(GrammarController.validateAlphabet(invalidAlphabet).some(issue => issue.kind === 'invalid_terminal'), 'the terminal alphabet owns English-letter validation');
});

require('node:test')('explicit alphabets retain user text and resolve declared nonterminal references', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const { SimulationController } = controller('SimulationController');
  const alphabet = { terminals: '{0-9}', nonterminals: 'BD' };
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{D}' }, { symbol: 'D', allowedValues: '{0-9}' }], 'B7', alphabet);
  assert.deepEqual(grammar.alphabet, alphabet);
  assert.deepEqual(GrammarController.validateAlphabet(grammar), []);
  alphabet.terminals = 'corruption';
  assert.equal(grammar.alphabet.terminals, '{0-9}');
  const simulation = new SimulationController(grammar);
  simulation.start('37');
  while (simulation.getState().status === 'loading') simulation.loadNext();
  while (simulation.getState().status === 'running') simulation.tick();
  assert.equal(simulation.getState().status, 'success');
});

require('node:test')('alphabet input catches unknown references, invalid symbols, missing members and cycles', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const alphabet = { terminals: '{0-9}', nonterminals: 'BD' };
  for (const [variables, kind] of [
    [[{ symbol: 'B', allowedValues: '{Q}' }], 'unknown_nonterminal'],
    [[{ symbol: 'Б', allowedValues: '{0-9}' }], 'invalid_nonterminal'],
    [[{ symbol: 'B', allowedValues: '{a-z}' }], 'invalid_terminal'],
    [[{ symbol: 'B', allowedValues: '{а-я}' }], 'outside_alphabet'],
    [[{ symbol: 'B', allowedValues: '{D}' }, { symbol: 'D', allowedValues: '{B}' }], 'cyclic_reference'],
  ]) {
    const grammar = GrammarController.createGrammar(variables, 'B', alphabet);
    assert.ok(GrammarController.validateAlphabet(grammar).some(error => error.kind === kind), kind);
  }
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: 'Q' }], 'B', alphabet);
  const issues = GrammarController.validateDraft(grammar, 'variable-values-0');
  assert.equal(issues[0].kind, 'unknown_nonterminal');
  assert.equal(issues[0].field, 'variable-values-0');
});

require('node:test')('undefined-reference input freezes for exactly one second and clears the offending field once', () => {
  const assert = require('node:assert/strict');
  const { InputGuardController } = controller('InputGuardController');
  let now = 0;
  let pending;
  let frozen = false;
  let value = 'Q';
  const history = [];
  const guard = new InputGuardController({ schedule(callback, delay) { pending = { callback, at: now + delay }; return pending; }, cancel() { pending = undefined; } });
  const errors = [{ kind: 'unknown_nonterminal', field: 'variable-values-0', message: 'Нетерминал Q не объявлен.' }];
  const actions = { record(issues) { history.push(...issues); }, clear() { value = ''; }, setFrozen(next) { frozen = next; } };
  assert.equal(guard.reject(errors, actions), true);
  assert.equal(frozen, true);
  assert.equal(history.length, 1);
  assert.equal(guard.reject(errors, actions), false);
  now = 999;
  assert.ok(now < pending.at);
  assert.equal(value, 'Q');
  now = 1000;
  assert.equal(now, pending.at);
  pending.callback();
  assert.equal(value, '');
  assert.equal(frozen, false);
  assert.equal(history.length, 1);
  guard.reject(errors, actions);
  guard.dispose();
  assert.equal(pending, undefined, 'unmount cancels delayed field changes');
});

require('node:test')('matching outcomes never add input mistakes or reduce grades', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = controller('SimulationController');
  const { ResultController } = controller('ResultController');
  for (const word of ['а', 'ааа', 'бб', 'аа']) {
    const solution = { template: 'аа', variables: [], terminals: ['а'] };
    const simulation = new SimulationController(solution);
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    const state = simulation.getState();
    assert.deepEqual(state.errors, []);
    const result = ResultController.createResult({ id: word, student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 't', title: 'Слово', description: 'Условие' }, solution, state, inputErrors: [], completedAt: '2026-10-08T10:00:00Z' });
    assert.equal(result.score, 100);
    assert.equal(result.passed, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.status, word === 'аа' ? 'success' : 'error');
  }
});

require('node:test')('input penalties default to five, are configurable by kind and fail only below fifty', () => {
  const assert = require('node:assert/strict');
  const { ScoringController } = controller('ScoringController');
  const error = { kind: 'unknown_nonterminal', field: 'variable-values-0', message: 'Нетерминал Q не объявлен.' };
  assert.equal(ScoringController.grade(Array(10).fill(error)).score, 50);
  assert.equal(ScoringController.grade(Array(10).fill(error)).passed, true);
  assert.equal(ScoringController.grade(Array(11).fill(error)).passed, false);
  const policy = ScoringController.defaultPolicy();
  policy.penalties.unknown_nonterminal = 30;
  const result = ScoringController.grade(Array(2).fill(error), policy);
  assert.equal(result.score, 40);
  assert.equal(result.penaltyTotal, 60);
  assert.equal(result.inputErrors[0].penalty, 30);
  assert.equal(ScoringController.grade(Array(50).fill(error)).score, 0);
  const data = new Map();
  const storage = { getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { data.set(key, value); } };
  ScoringController.savePolicy(policy, storage);
  assert.deepEqual(ScoringController.getPolicy(storage), policy);
  assert.throws(() => ScoringController.savePolicy({ penalties: { ...policy.penalties, unknown_nonterminal: -5 } }, storage));
});

require('node:test')('correcting alphabets retains hidden input mistakes without affecting template matching', () => {
  const assert = require('node:assert/strict');
  const { PreparationController } = controller('PreparationController');
  const { GrammarController } = controller('GrammarController');
  const preparation = new PreparationController();
  const error = { kind: 'unknown_nonterminal', field: 'variable-values-0', message: 'Нетерминал Q не объявлен.' };
  preparation.record([error]);
  const solution = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а-я}' }], 'B', { terminals: '{а-я}', nonterminals: 'B' });
  const accepted = preparation.submit(solution, 'я');
  assert.equal(accepted.ready, true);
  accepted.controller.loadNext();
  assert.equal(accepted.controller.tick().status, 'success');
  assert.deepEqual(preparation.getInputErrors(), [error]);
  const snapshot = preparation.getInputErrors();
  snapshot[0].message = 'corruption';
  assert.deepEqual(preparation.getInputErrors(), [error]);
});

require('node:test')('saved input penalties are snapshots and old results remain readable', () => {
  const assert = require('node:assert/strict');
  const { ResultController } = controller('ResultController');
  const { SimulationController } = controller('SimulationController');
  const { ScoringController } = controller('ScoringController');
  const data = new Map();
  const storage = { getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { data.set(key, value); } };
  const solution = { template: 'я', terminals: ['я'], variables: [], alphabet: { terminals: '{я}', nonterminals: '{}' } };
  const simulation = new SimulationController(solution);
  simulation.start('я');
  simulation.loadNext();
  const state = simulation.tick();
  const policy = ScoringController.defaultPolicy();
  const result = ResultController.createResult({ id: 'graded', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 't', title: 'Слово', description: 'Условие' }, solution, state, inputErrors: [{ kind: 'unknown_nonterminal', field: 'variable-values-0', message: 'Нетерминал Q не объявлен.' }], scoringPolicy: policy, completedAt: '2026-10-08T10:00:00Z' });
  solution.alphabet.terminals = 'corruption';
  policy.penalties.unknown_nonterminal = 30;
  ScoringController.savePolicy(policy, storage);
  ResultController.saveResult(result, storage);
  assert.equal(ResultController.getResults(storage)[0].score, 95);
  assert.equal(ResultController.getResults(storage)[0].inputErrors[0].penalty, 5);
  assert.equal(ResultController.getResults(storage)[0].solution.alphabet.terminals, '{я}');
  const legacy = { id: 'old', studentId: 's', studentName: 'Ученик', taskId: 't', taskTitle: 'Слово', status: 'success', score: 5, inputWord: 'я', logs: [], completedAt: result.completedAt };
  storage.setItem('results', JSON.stringify([legacy, result, { ...result, id: 'broken', score: 200 }]));
  assert.deepEqual(ResultController.getResults(storage).map(item => item.id), ['old', 'graded']);
});

require('node:test')('an unfinished terminal alphabet does not falsely reject a valid definition on blur', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'D', allowedValues: '{0-9}' }], 'D', { terminals: '', nonterminals: 'D' });
  const issues = GrammarController.validateAlphabet(grammar);
  assert.ok(issues.some(issue => issue.field === 'terminal-alphabet'));
  assert.deepEqual(issues.filter(issue => issue.field === 'variable-values-0'), []);
});

require('node:test')('a declared reference can be entered before its definition without erasing the valid reference', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{D}' }], 'B', { terminals: '{0-9}', nonterminals: 'BD' });
  assert.deepEqual(GrammarController.validateDraft(grammar, 'variable-values-0'), []);
  const issues = GrammarController.validateAlphabet(grammar);
  assert.deepEqual(issues.filter(issue => issue.field === 'variable-values-0'), []);
  assert.equal(issues.length, 1, 'only the missing D definition should block Next');
  assert.equal(issues[0].kind, 'empty_field');
  assert.deepEqual(GrammarController.validateAlphabet({ ...grammar, variables: [...grammar.variables, { symbol: 'D', allowedValues: '{0-9}' }] }), []);
});

require('node:test')('unused declared nonterminals need no definition but reachable symbols do', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а}' }, { symbol: 'C', allowedValues: '' }], 'B', { terminals: '{а-я}', nonterminals: 'BCD' });
  assert.deepEqual(GrammarController.validateAlphabet(grammar), []);
  assert.ok(GrammarController.validateAlphabet({ ...grammar, template: 'D' }).some(e => e.kind === 'empty_field'));
  assert.ok(GrammarController.validateAlphabet({ ...grammar, template: 'C' }).some(e => e.kind === 'empty_field'));
  assert.ok(GrammarController.validateAlphabet({ ...grammar, template: 'S' }).some(e => e.kind === 'unknown_nonterminal'));
});

require('node:test')('keyboard spaces belong to terminal alphabets and definitions', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  for (const values of ['{а-я }', 'а-я ', ' ', '{ }', '{␣}']) assert.equal(GrammarController.matches(' ', values), true, values);
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а-я }' }], 'B B', { terminals: '{а-я }', nonterminals: 'B' });
  assert.deepEqual(GrammarController.validateAlphabet(grammar), []);
});

require('node:test')('rejected edits retain existing content and remove only the last incorrect word on blur', () => {
  const assert = require('node:assert/strict');
  const { InputGuardController } = controller('InputGuardController');
  assert.equal(InputGuardController.removeLastWord('{а-я 0-9 плохое}'), '{а-я 0-9 }');
  assert.equal(InputGuardController.removeLastWord('{а-я;плохое}'), '{а-я;}');
  assert.equal(InputGuardController.removeLastWord('BD Б'), 'BD ');
  assert.equal(InputGuardController.removeLastWord('ошибка'), '');
});

require('node:test')('preparation stops at less than fifty with an immutable penalty policy', () => {
  const assert = require('node:assert/strict');
  const { PreparationController } = controller('PreparationController');
  const { ScoringController } = controller('ScoringController');
  const policy = ScoringController.defaultPolicy();
  const preparation = new PreparationController(policy);
  policy.penalties.invalid_terminal = 100;
  const issue = { kind: 'invalid_terminal', field: 'terminal-alphabet', message: 'Ошибка' };
  for (let i = 0; i < 10; i++) preparation.record([issue]);
  assert.equal(preparation.getGrade().score, 50);
  assert.equal(preparation.hasFailed(), false);
  preparation.record([issue]);
  assert.equal(preparation.getGrade().score, 45);
  assert.equal(preparation.hasFailed(), true);
  preparation.record([issue]);
  assert.equal(preparation.getInputErrors().length, 11, 'failed attempt cannot accumulate more edits');
  const grammar = { variables: [], terminals: ['а'], template: 'а', alphabet: { terminals: '{а}', nonterminals: '{}' } };
  assert.equal(preparation.submit(grammar, 'а').ready, false);
});

require('node:test')('input failure is saved exactly once with no fabricated comparison or transitions', () => {
  const assert = require('node:assert/strict');
  const { ResultController } = controller('ResultController');
  const inputErrors = Array.from({ length: 11 }, () => ({ kind: 'invalid_terminal', field: 'terminal-alphabet', message: 'Ошибка ввода' }));
  const result = ResultController.createInputFailure({ id: 'failed', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 't', title: 'Работа', description: 'Условие' }, solution: { variables: [], terminals: [], template: 'B' }, inputWord: 'а', inputErrors, completedAt: '2026-10-08T10:00:00Z' });
  assert.equal(result.score, 45);
  assert.equal(result.passed, false);
  assert.equal(result.comparisonPerformed, false);
  assert.deepEqual(result.logs, []);
  let raw = '[]';
  const storage = { getItem() { return raw; }, setItem(key, value) { raw = value; }, removeItem() {} };
  ResultController.saveResult(result, storage);
  ResultController.saveResult(result, storage);
  assert.equal(ResultController.getResults(storage).length, 1);
  assert.equal(ResultController.getResults(storage)[0].comparisonPerformed, false);
  assert.throws(() => ResultController.createInputFailure({ ...result, student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 't', title: 'Работа', description: 'Условие' }, solution: result.solution, inputErrors: [] }));
});

require('node:test')('correction preserves valid members in joined sets and finds the last invalid word', () => {
  const assert = require('node:assert/strict');
  const { InputGuardController } = controller('InputGuardController');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '' }], 'B', { terminals: '{а-я0-9 }', nonterminals: 'B' });
  const valid = value => GrammarController.validateAlphabet({ ...grammar, variables: [{ symbol: 'B', allowedValues: value }] }).every(error => error.field !== 'variable-values-0');
  assert.equal(InputGuardController.removeLastWord('{а-я0-9Я}', valid), '{а-я0-9}');
  assert.equal(InputGuardController.removeLastWord('{а-я ОШИБКА 0-9}', valid), '{а-я  0-9}');
  const draft = value => GrammarController.validateDraft({ ...grammar, alphabet: { ...grammar.alphabet, nonterminals: value } }, 'nonterminal-alphabet').length === 0;
  assert.equal(InputGuardController.removeLastWord('BCД', draft), 'BC');
  assert.equal(InputGuardController.removeLastWord('BC Б', draft), 'BC ');
});

require('node:test')('references in an unused definition do not require extra unused definitions', () => {
  const assert = require('node:assert/strict');
  const { GrammarController } = controller('GrammarController');
  const grammar = GrammarController.createGrammar([{ symbol: 'B', allowedValues: '{а}' }, { symbol: 'C', allowedValues: '{D}' }], 'B', { terminals: '{а-я}', nonterminals: 'BCD' });
  assert.deepEqual(GrammarController.validateAlphabet(grammar), []);
  assert.ok(GrammarController.validateAlphabet({ ...grammar, template: 'C' }).some(error => error.kind === 'empty_field'));
});
