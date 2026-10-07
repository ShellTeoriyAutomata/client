import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

describe('Проверка символов грамматики', async () => {
  const source = await readFile(new URL('../src/utils/grammarValidation.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  const { validateNonTerminal, validateTerminalPart, getNonTerminalErrors, getTerminalErrors, expandTerminalPart } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );

  it('принимает заглавные английские нетерминалы и составные имена', () => {
    for (const symbol of ['A', 'Z', 'UL', 'NUM', ' A ']) {
      assert.equal(validateNonTerminal(symbol), true, symbol);
    }
  });

  it('отклоняет нетерминалы другого алфавита, строчные буквы и спецсимволы', () => {
    for (const symbol of ['', ' ', 'А', 'Ё', 'a', 'Num', 'АB', 'І', 'Ї', 'A1', '1', 'A*', "A'", 'A-B', 'A B']) {
      assert.equal(validateNonTerminal(symbol), false, symbol);
    }
  });

  it('принимает русские терминалы обоих регистров, Ё и диапазоны', () => {
    for (const part of ['А', 'Я', 'а', 'я', 'Ё', 'ё', ' а ', 'А-Я', 'а-я', 'ё-ж', 'Е-Ё', 'Б-Д', 'А-А', '0', '9', '0-9', '_', 'ε']) {
      assert.equal(validateTerminalPart(part), true, part);
    }
  });

  it('отклоняет английские терминалы и неверные диапазоны', () => {
    for (const part of ['', ' ', 'A', 'Z', 'a', 'a-z', 'І', 'ї', '9-0', 'АБ', 'A-Б', 'Я-А', 'я-а', 'А-я', 'А--Я', 'А - Я', '*']) {
      assert.equal(validateTerminalPart(part), false, part);
    }
  });

  it('считает каждый неверный нетерминал отдельной ошибкой', () => {
    assert.equal(getNonTerminalErrors('A\\А\\Б\\c').length, 3);
    assert.deepEqual(getNonTerminalErrors('A\\B\\NUM'), []);
    assert.equal(getNonTerminalErrors('   ').length, 1);
  });

  it('считает каждый неверный терминал и пустое поле отдельной ошибкой', () => {
    assert.equal(getTerminalErrors(['A', 'B'], { A: 'а\\A\\B', B: '' }).length, 3);
    assert.deepEqual(getTerminalErrors(['A'], { A: 'а\\Я\\ё\\А-Я' }), []);
    assert.equal(getTerminalErrors(['A'], { A: '\\\\' }).length, 1);
  });

  it('разворачивает диапазоны в русском алфавите с Ё без смены регистра', () => {
    assert.deepEqual(expandTerminalPart('Е-Ж'), ['Е', 'Ё', 'Ж']);
    assert.deepEqual(expandTerminalPart('е-ж'), ['е', 'ё', 'ж']);
    assert.deepEqual(expandTerminalPart('ё'), ['ё']);
    assert.equal(expandTerminalPart('а-я').includes('ё'), true);
    assert.deepEqual(expandTerminalPart('А-я'), []);
    assert.deepEqual(expandTerminalPart('A-Z'), []);
  });
  it('не ограничивает количество и назначение нетерминалов', () => {
    assert.equal(getTerminalErrors(['A', 'B'], { A: 'а-я', B: 'А-Я' }, { A: 'street', B: 'street' }).length, 0);
    assert.equal(getNonTerminalErrors('A\\B\\C\\D\\E\\F\\G\\H\\I\\J').length, 0);
  });
});
