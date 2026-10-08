/** Render the production component without a browser or global storage mocks. */
function render(name, props) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const View = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'view', `${name}.js`)).default;
  return renderToStaticMarkup(React.createElement(View, props));
}

require('node:test')('teacher opens assignments without grammar fields or settings', () => {
  const assert = require('node:assert/strict');
  const html = render('TeacherDashboard', {});
  assert.match(html, /Название задания/);
  assert.match(html, /Описание/);
  assert.match(html, /Результаты/);
  assert.match(html, /Экспорт заданий/);
  assert.doesNotMatch(html, /Нетерминал|Терминальные символы|Тип шаблона|Настройки/);
});

require('node:test')('student receives the assignment and defines the grammar', () => {
  const assert = require('node:assert/strict');
  const html = render('StudentTaskView', { task: { id: 'a', title: 'Телефон', description: 'Создайте шаблон телефона' }, onBack() {} });
  assert.match(html, /Создайте шаблон телефона/);
  assert.doesNotMatch(html, /Допустимые значения|Начать с примера|grammar-example|ул\./);
  assert.match(html, /Нетерминал/);
  assert.match(html, /Шаблон/);
  assert.match(html, /Входное слово/);
  assert.match(html, /Алфавит терминалов/);
  assert.match(html, /Алфавит нетерминалов/);
  assert.match(html, /L.*любой символ/);
  assert.doesNotMatch(html, /Используйте английские буквы|Каждый символ шаблона соответствует|Слово остаётся в строке над стеком|В магазин загружается ваш шаблон/);
  assert.match(html, /novalidate/i);
  assert.match(html, /<button type="submit">Далее<\/button>/);
  assert.doesNotMatch(html, /Начать проверку|Английские буквы в терминалах запрещены/);
});

require('node:test')('alphabet editor labels symbol sets and offers no presets or terminal input', () => {
  const assert = require('node:assert/strict');
  const html = render('GrammarEditor', { variables: [{ symbol: 'B', allowedValues: '{а-яБ-Я_}' }], template: '', onVariablesChange() {}, onTemplateChange() {} });
  assert.match(html, /Нетерминал/);
  assert.match(html, /Описание множества/);
  assert.doesNotMatch(html, /\(заглавная английская буква\)/);
  assert.match(html, /\{а-яБ-Я_\}/);
  assert.doesNotMatch(html, /Допустимые значения|grammar-example|grammar-terminals|Телефон|Адрес|Email|или с разделителями/);
  assert.doesNotMatch(html, /pattern=|maxlength=/);
});

require('node:test')('input and template cursors appear together only after loading', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers/SimulationController.js'));
  const simulation = new SimulationController({ template: 'DS', terminals: [], variables: [{ symbol: 'D', allowedValues: '{0-9}' }, { symbol: 'S', allowedValues: '{!}' }] });
  simulation.start('7!');
  const loading = render('ComparisonPanel', { state: simulation.getState(), template: 'DS' });
  assert.match(loading, /Входное слово/);
  assert.match(loading, /Шаблон/);
  assert.doesNotMatch(loading, /aria-current="step"/);
  simulation.loadNext();
  simulation.loadNext();
  const start = render('ComparisonPanel', { state: simulation.getState(), template: 'DS' });
  assert.equal((start.match(/data-symbol-index="0" aria-current="step"/g) ?? []).length, 2);
  simulation.tick();
  const next = render('ComparisonPanel', { state: simulation.getState(), template: 'DS' });
  assert.equal((next.match(/data-symbol-index="1" aria-current="step"/g) ?? []).length, 2);
  assert.doesNotMatch(next, /<button|Исходное слово/);
});

require('node:test')('assignment description includes the student alphabet', () => {
  const assert = require('node:assert/strict');
  const html = render('AssignmentDescription', { description: 'Проверьте адрес', solution: { template: 'ул. DD', terminals: ['у', 'л', '.', ' '], variables: [{ symbol: 'D', allowedValues: '{0-9}' }] } });
  assert.match(html, /Проверьте адрес/);
  assert.match(html, /Нетерминалы/);
  assert.match(html, /Терминалы/);
  assert.match(html, /\{0-9\}/);
  assert.match(html, /L/);
});

require('node:test')('comparison displays only real symbols and keeps the remaining template pointer on error', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers/SimulationController.js'));
  const simulation = new SimulationController({ template: 'аб', terminals: [], variables: [] });
  for (const word of ['а', 'аб', '']) {
    simulation.start(word);
    while (simulation.getState().status === 'loading') simulation.loadNext();
    while (simulation.getState().status === 'running') simulation.tick();
    const html = render('ComparisonPanel', { state: simulation.getState(), template: 'аб' });
    assert.doesNotMatch(html, /ε/);
    assert.equal((html.match(/data-symbol-index=/g) ?? []).length, Array.from(word).length + 2);
    assert.equal((html.match(/aria-current="step"/g) ?? []).length, word === 'аб' ? 0 : 1);
    if (word === 'а') assert.match(html, /data-symbol-index="1" aria-current="step"/);
  }
  simulation.start('ε');
  const literal = render('ComparisonPanel', { state: simulation.getState(), template: 'L' });
  assert.equal((literal.match(/class="symbol-cell">ε</g) ?? []).length, 1, 'a typed epsilon is still a literal character');
});

require('node:test')('teacher attempt details display saved configuration and matching errors', () => {
  const assert = require('node:assert/strict');
  const html = render('ResultDetails', { result: { id: 'attempt', taskId: 'task', taskTitle: 'Адрес', taskDescription: 'Условие', studentId: 's', studentName: 'Ученик', studentGroup: '301', inputWord: 'Ба', status: 'error', completedAt: '2026-10-08T10:00:00Z', logs: [], errors: ['Нетерминал должен быть заглавной английской буквой.', 'Терминальное множество содержит английские буквы.', 'Символ не соответствует шаблону.'] }, onBack() {} });
  assert.match(html, /Журнал ошибок/);
  assert.match(html, /Нетерминал должен быть заглавной английской буквой/);
  assert.match(html, /Терминальное множество содержит английские буквы/);
  assert.match(html, /Символ не соответствует шаблону/);
});

require('node:test')('terminal field keeps validation implicit until the student submits the form', () => {
  const assert = require('node:assert/strict');
  for (const values of ['{a-z}', '{А-Яa}', '{9-~}', '{a']) {
    const html = render('GrammarEditor', { variables: [{ symbol: 'B', allowedValues: values }], onVariablesChange() {} });
    assert.match(html, /aria-describedby="alphabet-hint"/);
    assert.doesNotMatch(html, /aria-invalid="true"|role="alert"|английские буквы|Английские буквы/);
    assert.ok(html.includes(`value="${values}"`), 'keep the erroneous set so completion can count the error');
  }
  const valid = render('GrammarEditor', { variables: [{ symbol: 'B', allowedValues: '{а-яА-Я_}' }], onVariablesChange() {} });
  assert.doesNotMatch(valid, /aria-invalid="true"|role="alert"/);
});

require('node:test')('blocked preparation shows only a short error notice', () => {
  const assert = require('node:assert/strict');
  const html = render('PreparationFeedback', { errors: ['Нетерминал «Б» должен быть заглавной английской буквой.'], errorCount: 5 });
  assert.match(html, /role="alert"/);
  assert.match(html, />Ошибка</);
  assert.doesNotMatch(html, /Исправьте данные|Нетерминал «Б»/);
  assert.doesNotMatch(html, /Учтено ошибок|Журнал ошибок/);
  assert.doesNotMatch(html, /Пошаговое выполнение|Загрузка шаблона/);
});

require('node:test')('completed error report can be expanded and collapsed and counts all errors', () => {
  const assert = require('node:assert/strict');
  const html = render('LaboratoryErrors', { errors: ['Ошибка настройки', 'Ошибка сопоставления'] });
  assert.match(html, /<details[^>]*open=""/);
  assert.match(html, /<summary>Журнал ошибок \(2\)<\/summary>/);
  assert.match(html, /Ошибка настройки/);
  assert.match(html, /Ошибка сопоставления/);
  const clean = render('LaboratoryErrors', { errors: [] });
  assert.match(clean, /<summary>Журнал ошибок \(0\)<\/summary>/);
  assert.match(clean, /Ошибок не обнаружено/);
  assert.doesNotMatch(clean, /open=""/);
});

require('node:test')('completion lets the student return to editing after saving the attempt', () => {
  const assert = require('node:assert/strict');
  const CompletionPanel = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'view/CompletionPanel.js')).default;
  const React = require('react');
  let edited = false;
  const props = { passed: true, score: 95, maxScore: 100, errors: ['Ошибка'], saved: true, canEdit: true, onEdit() { edited = true; } };
  const html = render('CompletionPanel', props);
  assert.doesNotMatch(html, /Отчёт о выполнении|Журнал ошибок|Ошибка/);
  assert.match(html, /Вернуться к редактированию/);
  assert.match(html, /Результат сохранён/);
  assert.match(html, /Вы справились с работой/);
  assert.match(html, /Ваш балл:.*95 \/ 100/);
  const failed = render('CompletionPanel', { ...props, passed: false, score: 45 });
  assert.match(failed, /Вы не справились с работой/);
  assert.match(failed, /Ваш балл:.*45 \/ 100/);
  assert.match(render('CompletionPanel', { ...props, score: 100 }), /Ваш балл:.*100 \/ 100/);
  assert.match(render('CompletionPanel', { ...props, score: 50 }), /Ваш балл:.*50 \/ 100/);
  const elements = React.Children.toArray(CompletionPanel(props).props.children);
  const button = elements.find(element => element.type === 'button');
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  assert.equal(edited, true);
  const pending = render('CompletionPanel', { ...props, saved: false, canEdit: false });
  assert.match(pending, /<button[^>]*disabled=""/);
  assert.match(pending, /Сначала сохраните результат/);
  assert.match(pending, /Ваш балл:.*95 \/ 100/);
});

require('node:test')('teacher receives input penalties and a grade independently of a nonmatching word', () => {
  const assert = require('node:assert/strict');
  const html = render('ResultDetails', { result: { id: 'attempt', taskId: 'task', taskTitle: 'Слово', taskDescription: 'Условие', studentId: 's', studentName: 'Ученик', studentGroup: '301', inputWord: 'а', status: 'error', score: 45, maxScore: 100, passed: false, penaltyTotal: 55, completedAt: '2026-10-08T10:00:00Z', logs: [], errors: ['Необъявленный нетерминал Q'], inputErrors: [{ kind: 'unknown_nonterminal', field: 'variable-values-0', message: 'Необъявленный нетерминал Q', penalty: 55 }], comparisonMessage: 'Входное слово короче шаблона.' }, onBack() {} });
  assert.match(html, /45 \/ 100/);
  assert.match(html, /Не справился/);
  assert.match(html, /Не соответствует шаблону/);
  assert.match(html, /Ошибки ввода/);
  assert.match(html, /Необъявленный нетерминал Q/);
  assert.match(html, /−55/);
  assert.match(html, /Входное слово короче шаблона/);
});

require('node:test')('teacher can set a separate deduction for every input error category', () => {
  const assert = require('node:assert/strict');
  const html = render('ScoringSettings', {});
  assert.match(html, /Ошибки и штрафы/);
  assert.match(html, /Необъявленный нетерминал/);
  assert.match(html, /Циклическая ссылка/);
  assert.match(html, /Сохранить штрафы/);
  assert.match(html, /type="number"[^>]*value="5"/);
});

require('node:test')('teacher sees the actual qerror reason from the student attempt without epsilon placeholders', () => {
  const assert = require('node:assert/strict');
  const { SimulationController } = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers/SimulationController.js'));
  const { ResultController } = require(require('node:path').join(process.env.AUTOMATA_TEST_BUILD, 'controllers/ResultController.js'));
  const solution = { template: 'б', terminals: ['б'], variables: [] };
  const simulation = new SimulationController(solution);
  simulation.start('');
  simulation.loadNext();
  simulation.tick();
  const result = ResultController.createResult({ id: 'attempt', student: { id: 's', fio: 'Ученик', group: '301' }, task: { id: 'task', title: 'Слово', description: 'Условие' }, solution, state: simulation.getState(), completedAt: '2026-10-08T10:00:00Z' });
  const html = render('ResultDetails', { result, onBack() {} });
  assert.match(html, /\(q2, _, б\) → \(qerror, _, б\)/);
  assert.match(html, /символа стека «б»/);
  assert.match(html, /позиция 1/);
  assert.match(html, /Пустое слово/);
  assert.doesNotMatch(html, /ε/);
});

require('node:test')('teacher result shows the saved full template next to the input word', () => {
  const assert = require('node:assert/strict');
  const result = { id: 'attempt', taskId: 'task', taskTitle: 'Слово', taskDescription: 'Условие', studentId: 's', studentName: 'Ученик', studentGroup: '301', inputWord: 'ыфв ыфв', status: 'success', completedAt: '2026-10-08T10:00:00Z', logs: [], solution: { template: 'ыфв LLL', terminals: ['ы', 'ф', 'в', ' '], variables: [] } };
  const html = render('ResultDetails', { result, onBack() {} });
  assert.match(html, /<dt>Шаблон<\/dt><dd class="literal">ыфв LLL<\/dd>\s*<dt>Входное слово<\/dt><dd class="literal">ыфв ыфв<\/dd>/);
  assert.doesNotMatch(html, /Буквальные символы шаблона:/);
  assert.equal((html.match(/ыфв LLL/g) ?? []).length, 1);
  const legacy = render('ResultDetails', { result: { ...result, solution: undefined }, onBack() {} });
  assert.match(legacy, /<dt>Шаблон<\/dt><dd class="literal">Не сохранён<\/dd>/);
  assert.match(legacy, /ыфв ыфв/);
});

require('node:test')('early failure dialog stops the attempt without showing mistake details', () => {
  const assert = require('node:assert/strict');
  const html = render('FailureDialog', { saved: true, score: 45, maxScore: 100, onBack() {} });
  assert.match(html, /Ваш балл:.*45 \/ 100/);
  const pending = render('FailureDialog', { saved: false, score: 0, maxScore: 100, onBack() {} });
  assert.match(pending, /Ваш балл:.*0 \/ 100/);
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Вы не справились с работой/);
  assert.doesNotMatch(html, /Штраф|Нетерминал|Журнал ошибок/);
});

require('node:test')('teacher distinguishes an input failure from a performed comparison', () => {
  const assert = require('node:assert/strict');
  const html = render('ResultDetails', { result: { id: 'failed', taskTitle: 'Работа', studentName: 'Ученик', inputWord: '', completedAt: '2026-10-08T10:00:00Z', status: 'error', comparisonPerformed: false, score: 45, maxScore: 100, passed: false, inputErrors: [], logs: [] }, onBack() {} });
  assert.match(html, /Сопоставление не выполнялось/);
  assert.doesNotMatch(html, /Не соответствует шаблону/);
});
