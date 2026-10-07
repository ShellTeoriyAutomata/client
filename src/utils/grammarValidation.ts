/** Проверяет, что имя нетерминала состоит только из заглавных английских букв. */
export function validateNonTerminal(symbol: string): boolean {
  return /^[A-Z]+$/.test(symbol.trim());
}

/** Разворачивает букву, цифру, диапазон или epsilon; учитывает место Ё в русском алфавите. */
export function expandTerminalPart(part: string): string[] {
  const value = part.trim();
  if (value === '_' || value === 'ε') return [''];
  if (/^[0-9]$/.test(value)) return [value];
  if (/^[0-9]-[0-9]$/.test(value)) {
    const start = Number(value[0]);
    const end = Number(value[2]);
    return start <= end ? Array.from({ length: end - start + 1 }, (_, index) => String(start + index)) : [];
  }
  if (/^[А-Яа-яЁё]$/.test(value)) return [value];
  if (!/^(?:[А-ЯЁ]-[А-ЯЁ]|[а-яё]-[а-яё])$/.test(value)) return [];
  const uppercaseAlphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
  const alphabet = value[0] === value[0].toUpperCase()
    ? uppercaseAlphabet : uppercaseAlphabet.toLowerCase();
  const start = alphabet.indexOf(value[0]);
  const end = alphabet.indexOf(value[2]);
  return start <= end ? alphabet.slice(start, end + 1).split('') : [];
}

/** Проверяет русскую букву, цифру, диапазон одного алфавита и регистра или epsilon (_). */
export function validateTerminalPart(part: string): boolean {
  return expandTerminalPart(part).length > 0;
}

/** Возвращает отдельную ошибку для каждого неверного нетерминала в списке с разделителем \\. */
export function getNonTerminalErrors(input: string): string[] {
  const parts = input.split('\\').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return ['Не введены нетерминалы'];
  return parts.filter(part => !validateNonTerminal(part)).map(part =>
    `Неверный нетерминал "${part}". Используйте только заглавные английские буквы (A–Z).`
  );
}

/** Возвращает отдельную ошибку для каждого неверного терминала или пустого поля. */
export function getTerminalErrors(nonTerminals: string[], inputs: Record<string, string>): string[] {
  return nonTerminals.flatMap(nt => {
    const parts = (inputs[nt] || '').split('\\').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return [`Поле терминалов для "${nt}" не содержит значений`];
    return parts.filter(part => !validateTerminalPart(part)).map(part =>
      `Неверный терминал "${part}" в поле "${nt}". Используйте русские буквы, цифры, диапазоны а-я, А-Я, 0-9 или _ (epsilon).`
    );
  });
}

/** Тип целого поля адреса, определяемый по его подписи в шаблоне. */
export type GrammarFieldRole = 'symbol' | 'street' | 'house' | 'apartment';
/** Проверяемые типы ошибок автомата. */
export type GrammarErrorKind = 'mismatch' | 'input-short' | 'input-long'
  | 'street-short' | 'street-long' | 'house-short' | 'house-long' | 'apartment-short' | 'apartment-long';
/** Готовое действие, выбираемое студентом для текущей триады. */
export type GrammarAction = 'pop' | 'input-short' | 'input-long' | 'mismatch';
/** Строка таблицы с ожидаемым действием для конкретного состояния. */
export interface GrammarTransition {
  id: string;
  storeSymbol: string;
  inputSymbol: string;
  context: string;
  expectedAction: 'pop' | 'OK' | GrammarErrorKind;
  message: string;
  /** Позиция указателя в последовательности токенов шаблона. */
  templateIndex: number;
  /** Позиция указателя в слове без epsilon. */
  inputOffset: number;
  /** Остаток магазина до проверки; вершина находится слева. */
  stack: string[];
}
/** Результат проверки слова и данные для заполнения таблицы студентом. */
export interface GrammarSimulation {
  rows: GrammarTransition[];
  loadingLogs: string[];
  comparisonLogs: string[];
  inputErrors: string[];
  accepted: boolean;
  templateTokens: string[];
  wordSymbols: string[];
}

/** Возвращает pop и три встроенные ошибки; студент не создаёт собственные ошибки. */
export function getGrammarActions(): { value: GrammarAction; label: string }[] {
  return [
    { value: 'pop', label: 'pop — всё верно, идём дальше' },
    { value: 'input-short', label: 'Ошибка: слово короче / закончилось раньше' },
    { value: 'input-long', label: 'Ошибка: слово длиннее / лишние символы' },
    { value: 'mismatch', label: 'Ошибка: символ не соответствует' },
  ];
}

function expectedStudentAction(row: GrammarTransition): GrammarAction {
  if (row.expectedAction === 'OK') return 'pop';
  if (row.expectedAction.endsWith('-short')) return 'input-short';
  if (row.expectedAction.endsWith('-long')) return 'input-long';
  return row.expectedAction as GrammarAction;
}

/** Возвращает ограничения длины и название поля. */
export function getGrammarField(role: GrammarFieldRole): { min: number; max: number; label: string } {
  switch (role) {
    case 'street': return { min: 5, max: 10, label: 'Улица' };
    case 'house': return { min: 3, max: 3, label: 'Дом' };
    case 'apartment': return { min: 2, max: 2, label: 'Квартира' };
    default: return { min: 1, max: 1, label: 'Символ' };
  }
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function grammarTokens(template: string, nonTerminals: string[]): string[] {
  const names = [...nonTerminals].sort((a, b) => b.length - a.length);
  return template.match(new RegExp(`${names.map(escapePattern).join('|')}${names.length ? '|' : ''}[^]`, 'g')) || [];
}

/** Определяет, в каком поле введена последовательность нетерминалов; не изменяет сами значения. */
export function resolveGrammarInputs(first: string, second: string, nonTerminals: string[]): { template: string; input: string; swapped: boolean } {
  const hasNonTerminals = (value: string) => grammarTokens(value, nonTerminals).some(token => nonTerminals.includes(token));
  const swapped = !hasNonTerminals(first) && hasNonTerminals(second);
  return { template: swapped ? second : first, input: swapped ? first : second, swapped };
}

interface AddressPart {
  text: string;
  role?: Exclude<GrammarFieldRole, 'symbol'>;
}

function addressParts(value: string): AddressPart[] | null {
  const match = /^([\s\S]*?(?:улица|ул\.?)\s*)([\s\S]*?)(,\s*(?:дом|д\.?)\s*)([\s\S]*?)(,\s*(?:квартира|кв\.?)\s*)([\s\S]*)$/iu.exec(value);
  if (!match) return null;
  return [
    { text: match[1] }, { text: match[2], role: 'street' },
    { text: match[3] }, { text: match[4], role: 'house' },
    { text: match[5] }, { text: match[6], role: 'apartment' },
  ];
}

/** Проверяет один переход для каждого символа шаблона; длины адреса относятся к целому полю. */
export function simulateGrammar(templateInput: string, wordInput: string, nonTerminals: string[], definitions: Record<string, string>): GrammarSimulation {
  const resolved = resolveGrammarInputs(templateInput, wordInput, nonTerminals);
  const template = resolved.template;
  const word = resolved.input.replace(/[_ε]/g, '');
  const templateTokens = grammarTokens(template, nonTerminals);
  const templateParts = addressParts(template);
  const wordParts = addressParts(word);
  const parts = templateParts && wordParts
    ? templateParts.map((part, i) => ({ template: part.text, input: wordParts[i].text, role: part.role }))
    : [{ template, input: word, role: undefined }];
  const allowed = (nt: string) => (definitions[nt] || '').split('\\').flatMap(expandTerminalPart);
  const isEpsilon = (token: string) => token === '_' || token === 'ε';
  const patternFor = (token: string) => {
    if (isEpsilon(token)) return '';
    if (!nonTerminals.includes(token)) return escapePattern(token);
    const values = allowed(token);
    return `(${values.length ? values.map(escapePattern).join('|') : '(?!)'})`;
  };
  const rows: GrammarTransition[] = [];
  const inputErrors: string[] = [];
  let templateBase = 0;
  let inputBase = 0;
  let localTokenIndex = 0;
  let inputPosition = 0;
  const append = (storeSymbol: string, inputSymbol: string, context: string, expectedAction: GrammarTransition['expectedAction'], message: string) => {
    const templateIndex = templateBase + localTokenIndex;
    const remaining = templateTokens.slice(templateIndex).map(token => isEpsilon(token) ? 'ε' : token);
    const stack = [...remaining, 'Z0'];
    // Проверка границы поля добавляет виртуальную epsilon-вершину без чтения разделителя.
    if (stack[0] !== storeSymbol) stack.unshift(storeSymbol);
    rows.push({ id: `q${rows.length + 2}`, storeSymbol, inputSymbol: inputSymbol || 'ε', context, expectedAction, message,
      templateIndex, inputOffset: inputBase + inputPosition, stack });
  };
  for (const part of parts) {
    const tokens = grammarTokens(part.template, nonTerminals);
    const field = part.role ? getGrammarField(part.role) : null;
    const lengthAction: GrammarErrorKind | undefined = part.role && field
      ? part.input.length < field.min ? `${part.role}-short` : part.input.length > field.max ? `${part.role}-long` : undefined
      : undefined;
    const lengthMessage = field ? `${field.label}: длина ${part.input.length}, требуется ${field.min === field.max ? field.min : `${field.min}–${field.max}`}.` : '';
    if (lengthAction) inputErrors.push(lengthMessage);
    const match = new RegExp(`^${tokens.map(patternFor).join('')}$`).exec(part.input);
    let offset = 0;
    let capture = 1;
    let failed = false;
    let hasLengthRow = false;
    for (let index = 0; index < tokens.length; index++) {
      localTokenIndex = index;
      inputPosition = offset;
      const token = tokens[index];
      const context = field ? `${field.label} (${token}): символ ${offset + 1}` : `${token}: позиция ${index + 1}`;
      if (isEpsilon(token)) {
        append('ε', part.input[offset] || 'ε', context, 'pop', 'Epsilon: без чтения символа');
        continue;
      }
      const isNonTerminal = nonTerminals.includes(token);
      const values = isNonTerminal ? allowed(token) : [token];
      let actual: string;
      if (match && isNonTerminal) actual = match[capture++];
      else if (isNonTerminal && values.includes('') && new RegExp(`^${tokens.slice(index + 1).map(patternFor).join('')}$`).test(part.input.slice(offset))) actual = '';
      else actual = part.input[offset] || '';
      const alphabetValid = !part.role || !actual || (part.role === 'street' ? /^[А-Яа-яЁё]$/ : /^[0-9]$/).test(actual);
      let action: GrammarTransition['expectedAction'] = values.includes(actual) && alphabetValid ? 'pop' : actual ? 'mismatch' : 'input-short';
      let message = action === 'pop' ? `"${actual || 'ε'}" разрешён для ${token}` : `"${actual || 'ε'}" не соответствует ${token}.`;
      if (lengthAction && ((lengthAction.endsWith('-long') && offset >= (field?.max || 0)) || (!actual && action !== 'pop'))) {
        action = lengthAction;
        message = lengthMessage;
        hasLengthRow = true;
      }
      append(token, actual, context, action, message);
      if (action !== 'pop') {
        if (action !== lengthAction) inputErrors.push(`${context}: ${message}`);
        failed = true;
        break;
      }
      offset += actual.length;
    }
    if (!failed && offset < part.input.length) {
      localTokenIndex = tokens.length;
      inputPosition = offset;
      const action = lengthAction?.endsWith('-long') ? lengthAction : 'input-long';
      const message = action === lengthAction ? lengthMessage : `Шаблон поля закончился, остались символы "${part.input.slice(offset)}".`;
      append(part.role ? 'ε' : 'Z0', part.input[offset], field ? `${field.label}: конец шаблона поля` : 'Конец шаблона', action, message);
      if (action !== lengthAction) inputErrors.push(message);
      else hasLengthRow = true;
    }
    if (lengthAction && !hasLengthRow) {
      localTokenIndex = tokens.length;
      inputPosition = lengthAction.endsWith('-short') ? part.input.length : field?.max || 0;
      append('ε', lengthAction.endsWith('-short') ? 'ε' : part.input[field?.max || 0],
        `${field?.label}: конец поля`, lengthAction, lengthMessage);
    }
    templateBase += tokens.length;
    inputBase += part.input.length;
  }
  localTokenIndex = 0;
  inputPosition = 0;
  if (inputErrors.length === 0) append('Z0', 'ε', 'Конец слова и шаблона', 'OK', 'Успешное завершение');
  const tokens = grammarTokens(template, nonTerminals);
  const loadingLogs = [
    ...(resolved.swapped ? ['Последовательность нетерминалов распознана в поле «Проверочное слово»; адрес — в поле «Шаблон».'] : []),
    '--- Загрузка магазина ---', ...tokens.map((token, i) =>
      `(q${i === 0 ? 0 : 1}, ε, ${i === 0 ? 'Z0' : isEpsilon(tokens[i - 1]) ? 'ε' : tokens[i - 1]}) → (q1, ε, ${isEpsilon(token) ? 'ε' : token})`),
  ];
  const comparisonLogs = ['--- Проверка переходов ---', ...rows.map(row =>
    `(${row.id}, ${row.inputSymbol}, ${row.storeSymbol}) [${row.context}] → ${row.expectedAction}: ${row.message}`),
    inputErrors.length ? 'Слово отклонено' : 'Слово принято'];
  return { rows, loadingLogs, comparisonLogs, inputErrors, accepted: inputErrors.length === 0,
    templateTokens, wordSymbols: Array.from(word) };
}

/** Проверяет выбранные встроенные действия; ошибки длины любого поля относятся к короткому/длинному слову. */
export function getTransitionErrors(rows: GrammarTransition[], answers: Record<string, string>): string[] {
  return rows.flatMap(row => {
    const action = answers[row.id];
    const prefix = `${row.id}, ${row.context}, (${row.storeSymbol}, ${row.inputSymbol})`;
    if (!action) return [`${prefix}: выберите действие.`];
    return action === expectedStudentAction(row) ? [] : [`${prefix}: действие выбрано неверно. Проверьте символы и длину ещё раз.`];
  });
}
