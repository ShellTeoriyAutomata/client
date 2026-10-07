import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

async function createGrammarView(taskOptions = {}) {
  const source = await readFile(new URL('../src/view/StudentGrammarTaskView.tsx', import.meta.url), 'utf8');
  const validationSource = await readFile(new URL('../src/utils/grammarValidation.ts', import.meta.url), 'utf8');
  const { outputText: validationCode } = ts.transpileModule(validationSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  const validation = await import(`data:text/javascript;base64,${Buffer.from(validationCode).toString('base64')}`);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const states = [];
  let cursor = 0;
  let savedResult;
  const moduleExports = {};
  vm.runInNewContext(outputText, {
    exports: moduleExports,
    require: (name) => {
      switch (name) {
        case 'react/jsx-runtime': return jsxRuntime;
        case 'react': return {
          ...React,
          useState: (initial) => {
            const index = cursor++;
            if (index >= states.length) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], value => {
              states[index] = typeof value === 'function' ? value(states[index]) : value;
            }];
          },
        };
        case '../utils/grammarValidation': return validation;
        case '../controllers/AuthController': return { AuthController: {
          getCurrentStudent: () => ({ id: 'student', fio: 'Студент' }),
        } };
        case '../controllers/ResultController': return { ResultController: {
          saveResult: result => { savedResult = result; },
        } };
        default: throw new Error(`Unexpected dependency: ${name}`);
      }
    },
  });
  function render() {
    cursor = 0;
    return moduleExports.default({ task: { id: 'task', title: 'Грамматика', ...taskOptions }, onBack: () => {} });
  }
  function allNodes(node) {
    if (Array.isArray(node)) return node.flatMap(allNodes);
    if (!React.isValidElement(node)) return [];
    return [node, ...allNodes(node.props.children)];
  }
  function button(label) {
    return allNodes(render()).find(node => node.type === 'button' && node.props.children.trim?.() === label);
  }
  function input(placeholder, value) {
    const field = allNodes(render()).find(node => node.props.placeholder === placeholder);
    assert.ok(field, placeholder);
    field.props.onChange({ target: { value } });
  }
  function count() {
    return allNodes(render()).find(node => node.props.role === 'status').props.children.at(-1);
  }

  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (React.isValidElement(node)) return text(node.props.children);
    return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  }
  function labeled(label, value) {
    const field = allNodes(render()).find(node => node.props['aria-label'] === label);
    assert.ok(field, label);
    field.props.onChange({ target: { value } });
  }
  function transitions() {
    return allNodes(render()).filter(node => node.type === 'select' && node.props['aria-label']?.startsWith('Действие '));
  }
  return { input, button, render, allNodes, count, text, labeled, transitions, getSavedResult: () => savedResult };
}


function node(view, id) {
  return view.allNodes(view.render()).find(node => node.props['data-testid'] === id);
}
function pointer(view, label) {
  return view.allNodes(view.render()).find(node => node.props['aria-label'] === label)?.props['data-index'];
}
function current(view) { return node(view, 'current-triad'); }
function answer(view, value) {
  view.labeled('Действие текущей триады', value);
  view.button('Проверить переход').props.onClick();
}
function finishPops(view) {
  for (let index = 0; index < 200 && current(view); index++) answer(view, 'pop');
  assert.equal(current(view), undefined);
  view.button('Завершить и сохранить').props.onClick();
}
function start(view, template = 'A', word = 'а', definition = 'а') {
  view.input('Например: A\\B\\C\\NUM', 'A');
  view.button('Далее').props.onClick();
  view.labeled('Терминалы A', definition);
  view.button('Далее').props.onClick();
  view.input('Введите ваш шаблон...', template);
  view.input('Введите слово для проверки...', word);
  view.button('Симуляция').props.onClick();
}

it('показывает одну триаду и готовые действия, сдвигает указатели только после верного ответа', async () => {
  const view = await createGrammarView();
  start(view, 'AA', 'аа');
  assert.doesNotMatch(view.text(view.render()), /Конструктор ошибок/);
  const select = view.allNodes(view.render()).find(node => node.props['aria-label'] === 'Действие текущей триады');
  assert.deepEqual(view.allNodes(select).filter(node => node.type === 'option' && node.props.value).map(node => node.props.value),
    ['pop', 'input-short', 'input-long', 'mismatch']);
  assert.equal(view.allNodes(view.render()).filter(item => item.props['data-testid'] === 'current-triad').length, 1);
  assert.equal(pointer(view, 'Указатель шаблона'), 0);
  assert.equal(pointer(view, 'Указатель слова'), 0);
  assert.match(view.text(node(view, 'grammar-stack')), /AAZ0/);
  answer(view, 'input-long');
  assert.equal(view.count(), 1);
  assert.equal(pointer(view, 'Указатель шаблона'), 0);
  assert.equal(pointer(view, 'Указатель слова'), 0);
  assert.equal(view.getSavedResult(), undefined);
  assert.equal(view.button('Завершить и сохранить'), undefined);
  answer(view, 'pop');
  assert.equal(pointer(view, 'Указатель шаблона'), 1);
  assert.equal(pointer(view, 'Указатель слова'), 1);
  assert.equal(pointer(view, 'Указатель магазина'), 0);
  const nextSelect = view.allNodes(view.render()).find(node => node.props['aria-label'] === 'Действие текущей триады');
  assert.equal(nextSelect.props.value, '');
  answer(view, 'pop');
  assert.equal(pointer(view, 'Указатель слова'), 2);
  assert.match(view.text(current(view)), /Z0/);
  answer(view, 'pop');
  assert.equal(view.getSavedResult(), undefined);
  view.button('Завершить и сохранить').props.onClick();
  assert.equal(view.getSavedResult().mistakeCount, 1);
  assert.equal(view.getSavedResult().wordAccepted, true);
  assert.equal(view.getSavedResult().errorHistory.length, 1);
});

it('сохраняет ошибки неверного алфавита после исправлений и передаёт счётчик преподавателю', async () => {
  const view = await createGrammarView();
  view.input('Например: A\\B\\C\\NUM', 'А\\Б');
  view.button('Далее').props.onClick();
  assert.equal(view.count(), 2);
  view.input('Например: A\\B\\C\\NUM', 'A');
  view.button('Далее').props.onClick();
  view.labeled('Терминалы A', 'A\\b');
  view.button('Далее').props.onClick();
  assert.equal(view.count(), 4);
  view.button('Далее').props.onClick();
  assert.equal(view.count(), 6);
  view.labeled('Терминалы A', 'е-ж');
  view.button('Далее').props.onClick();
  view.input('Введите ваш шаблон...', 'A');
  view.input('Введите слово для проверки...', 'ё');
  view.button('Симуляция').props.onClick();
  answer(view, 'mismatch');
  assert.equal(view.count(), 7);
  finishPops(view);
  const result = view.getSavedResult();
  assert.equal(result.mistakeCount, 7);
  assert.equal(result.errorHistory.length, 7);
  assert.equal(result.logs.flatMap(log => typeof log === 'string' ? [] : log.items).filter(log => log.includes('Ошибка:')).length, 7);
  assert.ok(result.logs.some(log => typeof log !== 'string' && log.items.some(item => item.includes('Слово принято'))));
});

it('проверяет короткий дом по текущей триаде и сохраняет историю неверного выбора', async () => {
  const view = await createGrammarView({ grammarMode: 'address' });
  view.input('Например: A\\B\\C\\NUM', 'UL\\D\\K');
  view.button('Далее').props.onClick();
  view.labeled('Терминалы UL', 'а-я\\А-Я');
  view.labeled('Терминалы D', '0-9');
  view.labeled('Терминалы K', '0-9');
  view.button('Далее').props.onClick();
  view.input('Введите ваш шаблон...', 'ул. ULULULULULUL, д. DDD, кв. KK');
  view.input('Введите слово для проверки...', 'ул. Ленина, д. 12, кв. 45');
  view.button('Симуляция').props.onClick();
  assert.equal(view.count(), 1);
  while (!view.text(current(view)).includes('Дом (D): символ 3')) answer(view, 'pop');
  const position = pointer(view, 'Указатель слова');
  answer(view, 'input-long');
  assert.equal(view.count(), 2);
  assert.equal(pointer(view, 'Указатель слова'), position);
  answer(view, 'input-short');
  finishPops(view);
  const result = view.getSavedResult();
  assert.equal(result.mistakeCount, 2);
  assert.equal(result.errorHistory.length, 2);
  assert.equal(result.wordAccepted, false);
  assert.match(view.text(view.render()), /отклонено/);
  assert.ok(result.logs.some(log => typeof log !== 'string' && log.items.some(item => item.includes('house-short'))));
});

it('проверяет три готовые ошибки без создания пользовательских ошибок', async () => {
  for (const [template, word, expected] of [['AA', 'а', 'input-short'], ['A', 'аа', 'input-long'], ['A', 'б', 'mismatch']]) {
    const view = await createGrammarView();
    start(view, template, word);
    while (view.text(current(view)).includes('"а"') && !view.text(current(view)).includes('Z0')) answer(view, 'pop');
    const position = pointer(view, 'Указатель шаблона');
    answer(view, 'pop');
    assert.equal(view.count(), 2);
    assert.equal(pointer(view, 'Указатель шаблона'), position);
    answer(view, expected);
    assert.equal(current(view), undefined);
    view.button('Завершить и сохранить').props.onClick();
    assert.equal(view.getSavedResult().wordAccepted, false);
  }
});

it('epsilon удаляет вершину магазина без сдвига указателя слова; новая симуляция сбрасывает прогресс', async () => {
  const view = await createGrammarView();
  start(view, 'AA', 'а', 'а\\_');
  answer(view, 'pop');
  assert.equal(pointer(view, 'Указатель шаблона'), 1);
  assert.equal(pointer(view, 'Указатель слова'), 1);
  answer(view, 'pop');
  assert.equal(pointer(view, 'Указатель шаблона'), 2);
  assert.equal(pointer(view, 'Указатель слова'), 1);
  view.button('Назад').props.onClick();
  view.input('Введите слово для проверки...', 'аа');
  view.button('Симуляция').props.onClick();
  assert.equal(pointer(view, 'Указатель шаблона'), 0);
  assert.equal(pointer(view, 'Указатель слова'), 0);
  const select = view.allNodes(view.render()).find(node => node.props['aria-label'] === 'Действие текущей триады');
  assert.equal(select.props.value, '');
  assert.equal(view.text(node(view, 'transition-history')), '');
});

it('принимает пример со скриншота и проверяет каждую букву и цифру отдельной итерацией', async () => {
  const view = await createGrammarView({ grammarMode: 'address' });
  view.input('Например: A\\B\\C\\NUM', 'A\\B\\C\\D\\E\\F');
  view.button('Далее').props.onClick();
  view.labeled('Терминалы A', 'а-я');
  view.labeled('Терминалы B', 'А-Я');
  for (const name of ['C', 'D', 'E', 'F']) view.labeled(`Терминалы ${name}`, '0-9');
  view.button('Далее').props.onClick();
  view.input('Введите ваш шаблон...', 'ул. Лепсе, д. 444, кв. 52');
  view.input('Введите слово для проверки...', 'ул. BAAAA, д. CCC, кв. DD');
  view.button('Симуляция').props.onClick();
  assert.equal(view.count(), 0);
  const contexts = [];
  while (current(view)) {
    contexts.push(view.text(current(view)));
    answer(view, 'pop');
  }
  assert.equal(contexts.filter(text => /Улица \([AB]\): символ/.test(text)).length, 5);
  assert.equal(contexts.filter(text => /Дом \(C\): символ/.test(text)).length, 3);
  assert.equal(contexts.filter(text => /Квартира \(D\): символ/.test(text)).length, 2);
  view.button('Завершить и сохранить').props.onClick();
  assert.equal(view.getSavedResult().wordAccepted, true);
  assert.equal(view.getSavedResult().mistakeCount, 0);
  assert.match(view.getSavedResult().inputWord, /Template: ул\. BAAAA/);
});

it('помогает задать оба регистра русских букв для одного нетерминала', async () => {
  const view = await createGrammarView();
  view.input('Например: A\\B\\C\\NUM', 'A');
  view.button('Далее').props.onClick();
  const helper = view.allNodes(view.render()).find(item => item.type === 'button' && item.props['aria-label'] === 'Русские буквы обоих регистров A');
  assert.ok(helper);
  helper.props.onClick();
  const field = view.allNodes(view.render()).find(item => item.props['aria-label'] === 'Терминалы A');
  assert.equal(field.props.value, 'а-я\\А-Я');
  view.button('Далее').props.onClick();
  view.input('Введите ваш шаблон...', 'AAAAA');
  view.input('Введите слово для проверки...', 'Лепсе');
  view.button('Симуляция').props.onClick();
  finishPops(view);
  assert.equal(view.getSavedResult().wordAccepted, true);
});
