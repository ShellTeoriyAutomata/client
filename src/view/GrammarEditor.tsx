import { useEffect, useState } from 'react';
import type { AlphabetDefinition, GrammarDefinition, InputError, TaskVariable } from '../models/types';
import { GrammarController } from '../controllers/GrammarController';
import { InputGuardController } from '../controllers/InputGuardController';

interface GrammarEditorProps {
  variables: TaskVariable[];
  alphabet?: AlphabetDefinition;
  disabled?: boolean;
  onVariablesChange: (value: TaskVariable[]) => void;
  onAlphabetChange?: (value: AlphabetDefinition) => void;
  onInputErrors?: (errors: InputError[], grammar: GrammarDefinition) => void;
  onFrozenChange?: (frozen: boolean) => void;
}

/** Edit explicit alphabets and definitions, retaining rejected edits for the teacher only. */
export default function GrammarEditor({ variables, alphabet, disabled = false, onVariablesChange, onAlphabetChange, onInputErrors, onFrozenChange }: GrammarEditorProps) {
  const [frozen, setFrozen] = useState(false);
  const [guard] = useState(() => new InputGuardController({
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: handle => window.clearTimeout(handle as number),
  }));
  useEffect(() => () => guard.dispose(), [guard]);
  const currentAlphabet = alphabet ?? { terminals: '', nonterminals: variables.map(variable => variable.symbol).join('') };

  function reject(errors: InputError[], clear: () => void, grammar: GrammarDefinition) {
    guard.reject(errors, {
      clear,
      record: issues => onInputErrors?.(issues, grammar),
      setFrozen: value => { setFrozen(value); onFrozenChange?.(value); },
    });
  }

  function updateAlphabet(field: keyof AlphabetDefinition, value: string) {
    if (frozen || disabled) return;
    const next = { ...currentAlphabet, [field]: value };
    onAlphabetChange?.(next);
    const grammar = GrammarController.createGrammar(variables, '', next);
    const inputField = field === 'terminals' ? 'terminal-alphabet' : 'nonterminal-alphabet';
    reject(GrammarController.validateDraft(grammar, inputField),
      () => onAlphabetChange?.({ ...next, [field]: InputGuardController.removeLastWord(value, candidate =>
        GrammarController.validateDraft({ ...grammar, alphabet: { ...next, [field]: candidate } }, inputField).length === 0) }), grammar);
  }

  function updateVariable(index: number, field: keyof TaskVariable, value: string) {
    if (frozen || disabled) return;
    const next = variables.map((variable, i) => i === index ? { ...variable, [field]: value } : variable);
    onVariablesChange(next);
    const grammar = GrammarController.createGrammar(next, '', alphabet);
    const inputField = `variable-${field === 'symbol' ? 'symbol' : 'values'}-${index}`;
    reject(GrammarController.validateDraft(grammar, inputField), () => {
      const corrected = InputGuardController.removeLastWord(value, candidate => GrammarController.validateDraft({ ...grammar,
        variables: next.map((variable, i) => i === index ? { ...variable, [field]: candidate } : variable) }, inputField).length === 0);
      onVariablesChange(next.map((variable, i) => i === index ? { ...variable, [field]: corrected } : variable));
    }, grammar);
  }

  function checkDefinition(index: number) {
    if (frozen || disabled || !variables[index].allowedValues) return;
    const field = `variable-values-${index}`;
    const grammar = GrammarController.createGrammar(variables, '', alphabet);
    const errors = GrammarController.validateAlphabet(grammar).filter(error => error.field === field);
    reject(errors, () => {
      const corrected = InputGuardController.removeLastWord(variables[index].allowedValues, candidate => {
        if (!candidate.replace(/[{},;]/gu, '')) return false;
        const updated = { ...grammar, variables: variables.map((variable, i) => i === index ? { ...variable, allowedValues: candidate } : variable) };
        return GrammarController.validateAlphabet(updated).every(issue => issue.field !== field);
      });
      onVariablesChange(variables.map((variable, i) => i === index ? { ...variable, allowedValues: corrected } : variable));
    }, grammar);
  }

  return (
    <fieldset className="grammar-editor" disabled={frozen || disabled} aria-busy={frozen || disabled}>
      <legend>Терминалы и нетерминалы</legend>
      {frozen && <p className="error-text input-error-notice" role="alert">Ошибка</p>}
      <div className="alphabet-inputs">
        <div className="form-group"><label htmlFor="nonterminal-alphabet">Алфавит нетерминалов</label><input id="nonterminal-alphabet" value={currentAlphabet.nonterminals} onChange={event => updateAlphabet('nonterminals', event.target.value)} placeholder="BD" /></div>
        <div className="form-group"><label htmlFor="terminal-alphabet">Алфавит терминалов</label><input id="terminal-alphabet" value={currentAlphabet.terminals} onChange={event => updateAlphabet('terminals', event.target.value)} placeholder="{а-я0-9_␣}" /></div>
      </div>
      <div className="alphabet-toolbar"><button type="button" className="secondary-button add-variable" onClick={() => onVariablesChange([...variables, { symbol: '', allowedValues: '' }])}>+ Нетерминал</button></div>
      <div className="variable-list">
        {variables.map((variable, index) => (
          <div key={index} className="variable-row">
            <div className="form-group"><label htmlFor={`variable-symbol-${index}`}>Нетерминал</label><input id={`variable-symbol-${index}`} value={variable.symbol} onChange={event => updateVariable(index, 'symbol', event.target.value)} placeholder="B" /></div>
            <div className="form-group"><label htmlFor={`variable-values-${index}`}>Описание множества</label><input id={`variable-values-${index}`} value={variable.allowedValues} onChange={event => updateVariable(index, 'allowedValues', event.target.value)} onBlur={() => checkDefinition(index)} placeholder="{а-яБ-Я_}" aria-describedby="alphabet-hint" /></div>
            <button type="button" className="secondary-button remove-variable" title="Удалить нетерминал" aria-label={`Удалить нетерминал ${index + 1}`} onClick={() => onVariablesChange(variables.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
      </div>
      <small id="alphabet-hint" className="muted">Множество: {'{а-яБ-Я_}'}. Пробел можно ввести клавишей пробела или символом ␣.</small>
    </fieldset>
  );
}
