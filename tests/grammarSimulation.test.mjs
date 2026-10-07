import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

describe('Проверка адреса и действий автомата', async () => {
  const source = await readFile(new URL('../src/utils/grammarValidation.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  const { simulateGrammar, getTransitionErrors, resolveGrammarInputs, getNonTerminalErrors, getGrammarActions } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );
  function address(street, house, apartment) {
    return simulateGrammar(`ул. ${'UL'.repeat(street.replace(/[_ε]/g, '').length)}, д. ${'D'.repeat(house.replace(/[_ε]/g, '').length)}, кв. ${'K'.repeat(apartment.replace(/[_ε]/g, '').length)}`, `ул. ${street}, д. ${house}, кв. ${apartment}`,
      ['UL', 'D', 'K'], { UL: 'а-я\\А-Я', D: '0-9', K: '0-9' });
  }
  it('принимает граничные длины улицы и точные длины номеров, включая ведущие нули', () => {
    for (const street of ['Ленина', 'а'.repeat(5), 'ё'.repeat(10)]) {
      const result = address(street, '001', '02');
      assert.equal(result.accepted, true);
      assert.equal(result.inputErrors.length, 0);
      assert.equal(result.rows.at(-1).expectedAction, 'OK');
    }
  });
  it('различает все шесть ошибок длины', () => {
    for (const [street, house, apartment, expected] of [
      ['а'.repeat(4), '123', '12', 'street-short'],
      ['а'.repeat(11), '123', '12', 'street-long'],
      ['Ленина', '12', '12', 'house-short'],
      ['Ленина', '1234', '12', 'house-long'],
      ['Ленина', '123', '1', 'apartment-short'],
      ['Ленина', '123', '123', 'apartment-long'],
    ]) {
      const result = address(street, house, apartment);
      assert.equal(result.accepted, false);
      assert.equal(result.inputErrors.length, 1);
      assert.ok(result.rows.some(row => row.expectedAction === expected), expected);
    }
    assert.equal(address('абв', '12', '123').inputErrors.length, 3);
  });
  it('проверяет алфавит улицы, цифры номеров и значения конкретного нетерминала', () => {
    for (const [street, house, apartment] of [['Lenina', '123', '12'], ['Ленина', '12а', '12'], ['Ленина', '123', 'а2']]) {
      assert.ok(address(street, house, apartment).rows.some(row => row.expectedAction === 'mismatch'));
    }
    const result = simulateGrammar('A', 'б', ['A'], { A: 'а' });
    assert.equal(result.rows[0].expectedAction, 'mismatch');
  });
  it('трактует _ как epsilon, а не как пробел или символ слова', () => {
    const empty = simulateGrammar('A_', '_', ['A'], { A: '_' });
    assert.equal(empty.accepted, true);
    assert.equal(empty.rows[0].inputSymbol, 'ε');
    assert.equal(empty.rows[0].expectedAction, 'pop');
    const optional = simulateGrammar('Aа', 'а', ['A'], { A: 'а\\_' });
    assert.equal(optional.accepted, true);
    assert.equal(optional.rows[0].inputSymbol, 'ε');
    assert.equal(simulateGrammar('а б', 'а_б', [], {}).accepted, false);
    assert.equal(address('Ленина', '_', '12').rows.some(row => row.expectedAction === 'house-short'), true);
  });
  it('различает конец слова и лишний ввод и сбрасывает строковые ответы при новой симуляции', () => {
    assert.ok(simulateGrammar('A', '_', ['A'], { A: 'а' }).rows.some(row => row.expectedAction === 'input-short'));
    assert.ok(simulateGrammar('A', 'аб', ['A'], { A: 'а' }).rows.some(row => row.expectedAction === 'input-long'));
  });
  it('предлагает ровно три готовые ошибки и pop, проверяет их без конструктора', () => {
    assert.deepEqual(getGrammarActions().map(action => action.value), ['pop', 'input-short', 'input-long', 'mismatch']);
    const short = address('Ленина', '12', '12').rows.find(row => row.expectedAction === 'house-short');
    const long = address('Ленина', '1234', '12').rows.find(row => row.expectedAction === 'house-long');
    const mismatch = simulateGrammar('A', 'б', ['A'], { A: 'а' }).rows[0];
    assert.equal(getTransitionErrors([short], { [short.id]: 'input-short' }).length, 0);
    assert.equal(getTransitionErrors([long], { [long.id]: 'input-long' }).length, 0);
    assert.equal(getTransitionErrors([mismatch], { [mismatch.id]: 'mismatch' }).length, 0);
    for (const action of ['pop', '-', 'OK', 'input-long', 'Произвольная ошибка', '']) {
      assert.equal(getTransitionErrors([short], { [short.id]: action }).length, 1, action);
    }
    const end = simulateGrammar('A', 'а', ['A'], { A: 'а' }).rows.at(-1);
    assert.equal(getTransitionErrors([end], { [end.id]: 'pop' }).length, 0, 'завершение тоже оценивается как pop');
  });
  it('передаёт согласованные указатели и остаток магазина для каждого шага', () => {
    const result = simulateGrammar('NUMNUM', '12', ['NUM'], { NUM: '0-9' });
    assert.deepEqual(result.templateTokens, ['NUM', 'NUM']);
    assert.deepEqual(result.wordSymbols, ['1', '2']);
    assert.deepEqual(result.rows.map(row => row.templateIndex), [0, 1, 2]);
    assert.deepEqual(result.rows.map(row => row.inputOffset), [0, 1, 2]);
    assert.deepEqual(result.rows.map(row => row.stack), [['NUM', 'NUM', 'Z0'], ['NUM', 'Z0'], ['Z0']]);
    const optional = simulateGrammar('Aа', 'а', ['A'], { A: 'а\\_' });
    assert.deepEqual(optional.rows.map(row => row.inputOffset), [0, 0, 1]);
    assert.deepEqual(optional.rows.map(row => row.templateIndex), [0, 1, 2]);
    const short = simulateGrammar('ул. ULULULULULUL, д. DDD, кв. KK', 'ул. Ленина, д. 12, кв. 12',
      ['UL', 'D', 'K'], { UL: 'а-я\\А-Я', D: '0-9', K: '0-9' }).rows.find(row => row.expectedAction === 'house-short');
    assert.equal(short.inputOffset, 'ул. Ленина, д. 12'.length);
    assert.equal(short.stack[0], 'D');
  });
  it('различает состояния одинаковых пар символов при разных длинах поля', () => {
    const rows = address('а'.repeat(11), '123', '12').rows.filter(row => row.storeSymbol === 'UL' && row.inputSymbol === 'а');
    assert.ok(rows.some(row => row.expectedAction === 'pop'));
    assert.ok(rows.some(row => row.expectedAction === 'street-long'));
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  });
  it('принимает повторные нетерминалы и несколько нетерминалов для одного поля', () => {
    const result = simulateGrammar('ул. BAAAA, д. CCC, кв. DD', 'ул. Лепсе, д. 444, кв. 52',
      ['A', 'B', 'C', 'D'], { A: 'а-я', B: 'А-Я', C: '0-9', D: '0-9' });
    assert.equal(result.accepted, true);
    const street = result.rows.filter(row => ['A', 'B'].includes(row.storeSymbol));
    assert.equal(street.length, 5);
    assert.equal(street.map(row => row.inputSymbol).join(''), 'Лепсе');
    assert.ok(street.every(row => row.expectedAction === 'pop'));
    assert.equal(result.rows.filter(row => row.storeSymbol === 'C').length, 3);
    assert.equal(result.rows.filter(row => row.storeSymbol === 'D').length, 2);
    assert.equal(getNonTerminalErrors('A\\B\\C\\D\\E\\F\\G\\H\\I\\J').length, 0);
  });
  it('проверяет скриншот, где адрес и последовательность нетерминалов введены в обратных полях', () => {
    const template = 'ул. Лепсе, д. 444, кв. 52';
    const input = 'ул. BAAAA, д. CCC, кв. DD';
    const definitions = { A: 'а-я', B: 'А-Я', C: '0-9', D: '0-9' };
    const resolved = resolveGrammarInputs(template, input, ['A', 'B', 'C', 'D']);
    assert.equal(resolved.swapped, true);
    assert.equal(resolved.template, input);
    const result = simulateGrammar(template, input, ['A', 'B', 'C', 'D'], definitions);
    assert.equal(result.accepted, true);
  });
  it('сохраняет заданный регистр каждого нетерминала и поддерживает оба регистра в одной группе', () => {
    const result = simulateGrammar('ул. AAAAA, д. CCC, кв. DD', 'ул. ЛЕпсе, д. 444, кв. 52',
      ['A', 'C', 'D'], { A: 'а-я\\А-Я', C: '0-9', D: '0-9' });
    assert.equal(result.accepted, true);
    assert.equal(simulateGrammar('BA', 'ле', ['A', 'B'], { A: 'а-я', B: 'А-Я' }).accepted, false);
  });
});
