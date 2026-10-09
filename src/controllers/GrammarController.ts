import type { AlphabetDefinition, GrammarDefinition, InputError, TaskVariable } from '../models/types';

export class GrammarController {
  /** Reserved template symbol that matches any single input character. */
  static get universalSymbol(): string {
    return 'L';
  }

  /** Copy the student grammar and retain its literal template symbols for result display. */
  static createGrammar(variables: TaskVariable[], template: string, alphabet?: AlphabetDefinition): GrammarDefinition {
    const nonterminals = new Set([...variables.filter(variable => /^[A-Z]$/.test(variable.symbol)).map(variable => variable.symbol), this.universalSymbol]);
    const terminals = [...new Set(Array.from(template).filter(char => !nonterminals.has(char)))];
    return { terminals, variables: variables.map(variable => ({ ...variable })), template, ...(alphabet ? { alphabet: { ...alphabet } } : {}) };
  }

  /** Match one literal symbol against a joined/separated set with optional enclosing braces. */
  static matches(char: string, allowedValues: string, variables?: TaskVariable[]): boolean {
    if (Array.from(char).length !== 1) return false;
    const point = char.codePointAt(0)!;
    try {
      const ranges = variables ? this.expandedRanges(allowedValues, variables) : this.allowedRanges(allowedValues);
      return ranges.some(range => point >= range.start && point <= range.end);
    } catch {
      return false;
    }
  }

  /** Return an actionable validation error, or an empty string for a valid grammar. */
  static validate(grammar: GrammarDefinition): string {
    return this.validateAll(grammar)[0] ?? '';
  }

  /** Report each word symbol missing from the explicit terminal alphabet; legacy grammars have no alphabet field. */
  static validateInputWord(inputWord: string, grammar: GrammarDefinition): InputError[] {
    const alphabet = grammar.alphabet;
    if (!alphabet) return [];
    return Array.from(inputWord).flatMap((char, index) => !this.matches(char, alphabet.terminals, grammar.variables) ? [{
      kind: 'outside_alphabet' as const,
      field: 'input-word',
      message: `Символ входного слова «${char === ' ' ? '␣' : char}» (позиция ${index + 1}) отсутствует в алфавите терминалов.`,
    }] : []);
  }

  /** Validate one terminal set, including English letters hidden inside a range or malformed input. */
  static validateTerminalSet(allowedValues: string): string[] {
    const errors: string[] = [];
    let containsEnglish = /[A-Za-z]/.test(allowedValues);
    try {
      const ranges = this.allowedRanges(allowedValues);
      if (ranges.length === 0) errors.push('Терминальное множество не заполнено.');
      if (ranges.some(range => range.start > range.end)) errors.push('Некорректный диапазон в терминальном множестве.');
      containsEnglish ||= ranges.some(range =>
        Math.max(range.start, 65) <= Math.min(range.end, 90) ||
        Math.max(range.start, 97) <= Math.min(range.end, 122));
    } catch {
      errors.push('Некорректное терминальное множество. Проверьте фигурные скобки и экранирование символов.');
    }
    if (containsEnglish) errors.push('Терминальное множество содержит английские буквы. Они запрещены.');
    return errors;
  }

  /** Return alphabet-validation messages and the missing-template prerequisite. */
  static validateAll(grammar: GrammarDefinition): string[] {
    const errors = this.validateAlphabet(grammar).map(error => error.message);
    if (!grammar.template) errors.unshift('Шаблон не заполнен.');
    return errors;
  }

  /** Check the characters in one edited field without rejecting an unfinished set expression. */
  static validateDraft(grammar: GrammarDefinition, field: string): InputError[] {
    const issues: InputError[] = [];
    const declared = this.nonterminalSymbols(grammar);
    const add = (kind: InputError['kind'], message: string) => issues.push({ kind, field, message });
    if (field === 'nonterminal-alphabet') {
      const chars = Array.from(grammar.alphabet?.nonterminals ?? '').filter(char => !/[{},;\s]/u.test(char));
      if (chars.some(char => !/^[A-Z]$/.test(char))) add('invalid_nonterminal', `Алфавит нетерминалов «${grammar.alphabet?.nonterminals}» должен содержать заглавные английские буквы.`);
      if (new Set(chars).size !== chars.length) add('duplicate_nonterminal', 'В алфавите нетерминалов есть повторные обозначения.');
      return issues;
    }
    const symbolIndex = /^variable-symbol-(\d+)$/.exec(field);
    if (symbolIndex) {
      const index = Number(symbolIndex[1]);
      const symbol = grammar.variables[index]?.symbol ?? '';
      if (!symbol) return [];
      if (!/^[A-Z]$/.test(symbol)) add('invalid_nonterminal', `Нетерминал «${symbol}» должен быть одной заглавной английской буквой.`);
      else if (symbol === this.universalSymbol) add('reserved_nonterminal', 'Нетерминал L зарезервирован.');
      else if (!declared.has(symbol)) add('unknown_nonterminal', `Нетерминал «${symbol}» отсутствует в алфавите нетерминалов.`);
      if (grammar.variables.some((variable, i) => i !== index && variable.symbol === symbol)) add('duplicate_nonterminal', `Нетерминал «${symbol}» объявлен повторно.`);
      return issues;
    }
    const valuesIndex = /^variable-values-(\d+)$/.exec(field);
    const values = field === 'terminal-alphabet' ? grammar.alphabet?.terminals ?? '' : valuesIndex ? grammar.variables[Number(valuesIndex[1])]?.allowedValues ?? '' : '';
    if (/[a-z]/.test(values)) add('invalid_terminal', `Терминальное множество «${values}» содержит строчные английские буквы.`);
    const unknown = [...new Set(Array.from(values).filter(char => /^[A-Z]$/.test(char) && !declared.has(char)))];
    if (unknown.length) add('unknown_nonterminal', `Необъявленный нетерминал: ${unknown.map(char => `«${char}»`).join(', ')}.`);
    return issues;
  }

  /** Collect input-stage alphabet mistakes; word matching and length are not input mistakes. */
  static validateAlphabet(grammar: GrammarDefinition): InputError[] {
    const issues: InputError[] = [];
    const add = (kind: InputError['kind'], field: string, message: string) => issues.push({ kind, field, message });
    const declared = this.nonterminalSymbols(grammar);
    const used = new Set(Array.from(grammar.template + (grammar.alphabet?.terminals ?? '')).filter(char => /^[A-Z]$/.test(char)));
    for (const symbol of used) {
      const definition = grammar.variables.find(variable => variable.symbol === symbol);
      for (const reference of Array.from(definition?.allowedValues ?? '').filter(char => /^[A-Z]$/.test(char))) used.add(reference);
    }
    let terminalRanges: { start: number; end: number }[] | undefined;
    if (grammar.alphabet) {
      issues.push(...this.validateDraft(grammar, 'nonterminal-alphabet'));
      if (!grammar.alphabet.nonterminals.trim()) add('empty_field', 'nonterminal-alphabet', 'Алфавит нетерминалов не заполнен. Для пустого множества введите {}.');
      if (!this.validBraces(grammar.alphabet.nonterminals)) add('invalid_set', 'nonterminal-alphabet', 'Некорректная запись алфавита нетерминалов.');
      const terminalIssues = this.validateSet(grammar, 'terminal-alphabet', grammar.alphabet.terminals);
      issues.push(...terminalIssues);
      if (terminalIssues.length === 0) {
        try { terminalRanges = this.expandedRanges(grammar.alphabet.terminals, grammar.variables); } catch { /* Reported by validateSet. */ }
      }
      for (const symbol of used) {
        if (declared.has(symbol) && symbol !== this.universalSymbol && !grammar.variables.some(variable => variable.symbol === symbol)) {
          add('empty_field', 'nonterminal-alphabet', `Для нетерминала «${symbol}» не задано описание множества.`);
        }
      }
    }
    grammar.variables.forEach((variable, index) => {
      const symbolField = `variable-symbol-${index}`;
      const valuesField = `variable-values-${index}`;
      issues.push(...this.validateDraft(grammar, symbolField));
      if (!variable.symbol) add('empty_field', symbolField, 'Обозначение нетерминала не заполнено.');
      if (grammar.alphabet && !variable.allowedValues && !used.has(variable.symbol)) return;
      const setIssues = this.validateSet(grammar, valuesField, variable.allowedValues);
      issues.push(...setIssues);
      if (terminalRanges && setIssues.length === 0 && !variable.allowedValues.includes(this.universalSymbol)) {
        try {
          if (this.expandedRanges(variable.allowedValues, grammar.variables).some(range => !this.covered(range, terminalRanges!))) {
            add('outside_alphabet', valuesField, `Множество «${variable.symbol}» содержит символы вне алфавита терминалов.`);
          }
        } catch { /* Reported by validateSet. */ }
      }
    });
    if (grammar.alphabet) {
      const unknown = [...new Set(Array.from(grammar.template).filter(char => /^[A-Z]$/.test(char) && !declared.has(char)))];
      if (unknown.length) add('unknown_nonterminal', 'template', `В шаблоне есть необъявленные нетерминалы: ${unknown.join(', ')}.`);
      const outside = terminalRanges ? [...new Set(Array.from(grammar.template).filter(char => !declared.has(char) && !/^[A-Z]$/.test(char) &&
        !terminalRanges!.some(range => char.codePointAt(0)! >= range.start && char.codePointAt(0)! <= range.end)))] : [];
      if (outside.length) add('outside_alphabet', 'template', `Терминалы шаблона отсутствуют в алфавите: ${outside.map(char => char === ' ' ? '␣' : char).join(', ')}.`);
    }
    return issues;
  }

  private static nonterminalSymbols(grammar: GrammarDefinition): Set<string> {
    return new Set([this.universalSymbol, ...(grammar.alphabet ? Array.from(grammar.alphabet.nonterminals).filter(char => /^[A-Z]$/.test(char)) : grammar.variables.map(variable => variable.symbol).filter(char => /^[A-Z]$/.test(char)))]);
  }

  private static validBraces(values: string): boolean {
    const text = values.trim();
    return !/[{}]/.test(text) || /^\{[^{}]*\}$/.test(text);
  }

  private static validateSet(grammar: GrammarDefinition, field: string, values: string): InputError[] {
    const issues = this.validateDraft(grammar, field);
    if (!values) return [...issues, { kind: 'empty_field', field, message: 'Терминальное множество не заполнено.' }];
    try {
      const ranges = this.allowedRanges(values);
      if (ranges.length === 0 || ranges.some(range => range.start > range.end)) {
        issues.push({ kind: 'invalid_set', field, message: 'Пустое множество или некорректный диапазон.' });
      }
      if (ranges.some(range => range.start !== range.end && (Math.max(range.start, 65) <= Math.min(range.end, 90) || Math.max(range.start, 97) <= Math.min(range.end, 122))) && !issues.some(issue => issue.kind === 'invalid_terminal')) {
        issues.push({ kind: 'invalid_terminal', field, message: 'Диапазон содержит английские буквы вместо терминалов.' });
      }
      if (!issues.some(issue => issue.kind === 'unknown_nonterminal')) this.expandedRanges(values, grammar.variables);
    } catch (error) {
      // Declared but unfinished definitions are reported once for the alphabet, not as invalid references.
      if (error instanceof ReferenceError && grammar.alphabet) return issues;
      issues.push({ kind: error instanceof RangeError ? 'cyclic_reference' : error instanceof ReferenceError ? 'empty_field' : 'invalid_set', field,
        message: error instanceof Error && (error instanceof RangeError || error instanceof ReferenceError) ? error.message : 'Некорректное множество: проверьте скобки и экранирование.' });
    }
    return issues;
  }

  private static expandedRanges(values: string, variables: TaskVariable[], visiting = new Set<string>()): { start: number; end: number }[] {
    return this.allowedRanges(values).flatMap(range => {
      if (range.start !== range.end || range.start < 65 || range.start > 90) return [range];
      const symbol = String.fromCodePoint(range.start);
      if (symbol === this.universalSymbol) return [{ start: 0, end: 0x10ffff }];
      const variable = variables.find(item => item.symbol === symbol);
      if (!variable) throw new ReferenceError(`Нетерминал «${symbol}» не описан.`);
      if (visiting.has(symbol)) throw new RangeError(`Циклическая ссылка на нетерминал «${symbol}».`);
      return this.expandedRanges(variable.allowedValues, variables, new Set([...visiting, symbol]));
    });
  }

  private static covered(range: { start: number; end: number }, alphabet: { start: number; end: number }[]): boolean {
    let cursor = range.start;
    for (const allowed of [...alphabet].sort((a, b) => a.start - b.start)) {
      if (allowed.start <= cursor && allowed.end >= cursor) cursor = allowed.end + 1;
      if (cursor > range.end) return true;
    }
    return false;
  }

  private static allowedRanges(value: string): { start: number; end: number }[] {
    let text = /[{}]/.test(value) ? value.trim() : value;
    if (text.startsWith('{') || text.endsWith('}')) {
      if (!text.startsWith('{') || !text.endsWith('}')) throw new Error('Unbalanced set braces');
      text = text.slice(1, -1);
    }
    // A single separator or backslash may itself be the desired literal symbol.
    if (text === ',' || text === ';' || text === '\\') {
      const point = text.codePointAt(0)!;
      return [{ start: point, end: point }];
    }
    const chunks: { char: string; literal: boolean }[][] = [[]];
    const chars = Array.from(text);
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      if (char === '\\') {
        const next = chars[index + 1];
        if (next === undefined) throw new Error('Missing escaped symbol');
        chunks[chunks.length - 1].push({ char: next === '␣' ? ' ' : next, literal: true });
        index += 1;
      } else if (char === ',' || char === ';' || (char !== ' ' && /\s/u.test(char))) {
        chunks.push([]);
      } else {
        if (char === '{' || char === '}') throw new Error('Unexpected set brace');
        chunks[chunks.length - 1].push({ char: char === '␣' ? ' ' : char, literal: char === '␣' || char === ' ' });
      }
    }
    return chunks.flatMap(chunk => {
      const ranges: { start: number; end: number }[] = [];
      for (let index = 0; index < chunk.length; index += 1) {
        const start = chunk[index].char.codePointAt(0)!;
        if (chunk[index + 1]?.char === '-' && !chunk[index + 1].literal && chunk[index + 2] !== undefined) {
          ranges.push({ start, end: chunk[index + 2].char.codePointAt(0)! });
          index += 2;
        } else ranges.push({ start, end: start });
      }
      return ranges;
    });
  }
}
