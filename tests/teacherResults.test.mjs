import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

it('преподаватель видит счётчик в списке, историю в деталях и результат проверки слова', async () => {
  const source = await readFile(new URL('../src/view/tabs/ResultsTab.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const result = {
    id: 'result', studentName: 'Студент', taskTitle: 'Адрес', completedAt: '2026-10-07T12:00:00Z',
    status: 'success', mistakeCount: 2, wordAccepted: false,
    errorHistory: ['Ошибка: короткий дом', 'Ошибка: неверный pop'], logs: [],
  };
  const states = [];
  let cursor = 0;
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: name => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === '../../controllers/ResultController') return { ResultController: { getResults: () => [result] } };
      if (name === 'react') return { ...React, useState: initial => {
        const index = cursor++;
        if (index >= states.length) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = value; }];
      } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function render() { cursor = 0; return exports.default(); }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return React.isValidElement(node) ? [node, ...nodes(node.props.children)] : [];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (React.isValidElement(node)) return text(node.props.children);
    return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  }
  assert.match(text(render()), /Ошибок:\s*2/);
  nodes(render()).find(node => node.props.className === 'list-item').props.onClick();
  assert.match(text(render()), /Количество ошибок:\s*2/);
  assert.match(text(render()), /короткий дом/);
  assert.match(text(render()), /неверный pop/);
  assert.match(text(render()), /Проверочное слово:\s*Отклонено/);
});
