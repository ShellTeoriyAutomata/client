import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import type { Task, TaskVariable, GrammarDefinition, Result, AlphabetDefinition, InputError } from '../models/types';
import type { SimulationController, SimulationState } from '../controllers/SimulationController';
import { PreparationController, type PreparationFeedback as Feedback } from '../controllers/PreparationController';
import { GrammarController } from '../controllers/GrammarController';
import { AuthController } from '../controllers/AuthController';
import { ResultController } from '../controllers/ResultController';
import GrammarEditor from './GrammarEditor';
import FailureDialog from './FailureDialog';
import CompletionPanel from './CompletionPanel';
import AssignmentDescription from './AssignmentDescription';
import ComparisonPanel from './ComparisonPanel';
import PreparationFeedback from './PreparationFeedback';

interface StudentTaskViewProps {
  task: Task;
  onBack: () => void;
}

/** Prepare a student-defined grammar, load it into the stack and compare it with the word. */
export default function StudentTaskView({ task, onBack }: StudentTaskViewProps) {
  const [inputWord, setInputWord] = useState('');
  const [variables, setVariables] = useState<TaskVariable[]>([]);
  const [template, setTemplate] = useState('');
  const [alphabet, setAlphabet] = useState<AlphabetDefinition>({ terminals: '', nonterminals: '' });
  const [failed, setFailed] = useState(false);
  const failureResultRef = useRef<Result | null>(null);
  const [editorFrozen, setEditorFrozen] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState<{ controller: SimulationController; grammar: GrammarDefinition; inputErrors: InputError[]; id: string } | null>(null);
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [pendingResult, setPendingResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [preparation, setPreparation] = useState(() => new PreparationController());
  const [preparationFeedback, setPreparationFeedback] = useState<Feedback | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [simState?.logs]);

  useEffect(() => {
    if (attempt) simulationRef.current?.focus({ preventScroll: true });
  }, [attempt]);

  function finishInputFailure(grammar: GrammarDefinition) {
    if (!preparation.hasFailed() || failureResultRef.current) return;
    setFailed(true);
    const student = AuthController.getCurrentStudent();
    if (!student) { setError('Результат не сохранён: войдите в кабинет ученика.'); return; }
    const result = ResultController.createInputFailure({ id: crypto.randomUUID(), student, task,
      solution: grammar, inputWord, inputErrors: preparation.getInputErrors(), scoringPolicy: preparation.getPolicy(), completedAt: new Date().toISOString() });
    failureResultRef.current = result;
    try {
      ResultController.saveResult(result);
      setSaved(true);
      setError('');
    } catch {
      setPendingResult(result);
      setError('Не удалось сохранить результат. Повторите сохранение.');
    }
  }

  function recordInputErrors(issues: InputError[], draft: GrammarDefinition) {
    preparation.record(issues);
    setPreparationFeedback(null);
    finishInputFailure(GrammarController.createGrammar(draft.variables, template, draft.alphabet));
  }

  function handleStart(event: FormEvent) {
    event.preventDefault();
    if (editorFrozen || failed) return;
    const grammar = GrammarController.createGrammar(variables, template, alphabet);
    const next = preparation.submit(grammar, inputWord);
    if (!next.ready) {
      if (preparation.hasFailed()) { finishInputFailure(grammar); return; }
      setPreparationFeedback({ errors: next.errors, errorCount: next.errorCount });
      setError('');
      return;
    }
    setAttempt({ controller: next.controller, grammar: next.grammar, inputErrors: next.inputErrors, id: crypto.randomUUID() });
    setSimState(next.state);
    setPreparationFeedback(null);
    setPendingResult(null);
    setSaved(false);
    setError('');
  }

  const advance = useCallback(() => {
    if (!attempt) return;
    const before = attempt.controller.getState();
    if (before.status !== 'loading' && before.status !== 'running') return;
    const next = before.status === 'loading' ? attempt.controller.loadNext() : attempt.controller.tick();
    setSimState(next);
    if (next.status === 'success' || next.status === 'error') {
      const student = AuthController.getCurrentStudent();
      if (!student) { setError('Результат не сохранён: войдите в кабинет ученика.'); return; }
      const result = ResultController.createResult({ id: attempt.id, student, task,
        solution: attempt.grammar, state: next, inputErrors: attempt.inputErrors, scoringPolicy: preparation.getPolicy(), completedAt: new Date().toISOString() });
      try {
        ResultController.saveResult(result);
        setSaved(true);
      } catch {
        setPendingResult(result);
        setError('Не удалось сохранить результат. Повторите сохранение.');
      }
    }
  }, [attempt, task, preparation]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (simState?.status === 'loading' || simState?.status === 'running') {
        event.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, simState?.status]);

  function retrySave() {
    if (!pendingResult) return;
    try {
      ResultController.saveResult(pendingResult);
      setPendingResult(null);
      setSaved(true);
      setError('');
    } catch {
      setError('Не удалось сохранить результат. Проверьте доступность локального хранилища.');
    }
  }

  function returnToEditing() {
    if (pendingResult) return;
    setSimState(null);
    setFailed(false);
    failureResultRef.current = null;
    setEditorFrozen(false);
    setAttempt(null);
    setSaved(false);
    setPreparation(new PreparationController());
    setPreparationFeedback(null);
    setError('');
  }

  const active = simState?.status === 'loading' || simState?.status === 'running';
  const comparing = simState?.status === 'running' || simState?.status === 'error';
  const word = Array.from(simState?.inputWord ?? '');
  const templateChars = Array.from(attempt?.grammar.template ?? '');
  const display = (char: string) => char === ' ' ? '␣' : char;
  const solution = attempt?.grammar ?? GrammarController.createGrammar(variables, template, alphabet);
  const grade = preparation.getGrade();

  return (
    <div className="container dashboard student-task">
      <div inert={failed}><div className="screen-heading"><button className="secondary-button" onClick={onBack}>← К заданиям</button><h2>{task.title}</h2></div>
      <AssignmentDescription description={task.description} solution={solution} /></div>
      {!simState && !failed && (
        <form className="form-column solution-form" onSubmit={handleStart} noValidate>
          <GrammarEditor variables={variables} alphabet={alphabet} onVariablesChange={setVariables} onAlphabetChange={setAlphabet} onInputErrors={recordInputErrors} onFrozenChange={setEditorFrozen} />
          <div className="form-group"><label htmlFor="grammar-template">Шаблон</label><input id="grammar-template" value={template} onChange={event => { setTemplate(event.target.value); setPreparationFeedback(null); }} placeholder="Введите свой шаблон" disabled={editorFrozen} /></div>
          <div className="form-group"><label htmlFor="input-word">Входное слово</label><input id="input-word" value={inputWord} onChange={event => { setInputWord(event.target.value); setPreparationFeedback(null); }} placeholder="Введите слово для сопоставления" disabled={editorFrozen} /></div>
          {preparationFeedback && <PreparationFeedback errors={preparationFeedback.errors} errorCount={preparationFeedback.errorCount} />}
          <button type="submit" disabled={editorFrozen}>Далее</button>
        </form>
      )}
      {simState && (
        <div className="simulation" ref={simulationRef} tabIndex={0} aria-label="Пошаговое выполнение: для такта нажмите пробел">
          <ComparisonPanel state={simState} template={solution.template} />
          <div className="simulation-controls">
            <strong role="status">{simState.status === 'loading' ? 'Загрузка шаблона в стек' : simState.status === 'running' ? 'Сопоставление слова и шаблона' : simState.status === 'success' ? 'Слово соответствует шаблону' : 'Слово не соответствует шаблону'}</strong>
            <code>{simState.status === 'success' ? 'qf' : simState.status === 'error' ? 'qerror' : `q${simState.currentStateIndex}`}</code>
            {active && <span className="muted">Для такта нажмите пробел</span>}
          </div>
          <div className="simulation-layout">
            <section className="stack-panel">
              <h3>Магазин (стек шаблона)</h3>
              {simState.status === 'loading' && <div className="loading-tray"><p>Следующий символ: <strong>{display(templateChars[simState.loadingIndex])}</strong></p><p className="template-pending">{templateChars.slice(0, simState.loadingIndex + 1).map(display).join('')} <span aria-hidden="true">↓</span></p><small className="muted">Загрузка справа налево; первый символ шаблона будет на вершине.</small></div>}
              <div className="stack-list" aria-label="Содержимое стека, вершина сверху">
                {simState.stack.map((char, index) => <div key={index} className={`stack-row ${index === 0 && comparing ? 'is-current' : ''}`} aria-current={index === 0 && comparing ? 'step' : undefined}><span className="stack-pointer">{index === 0 && comparing ? '→' : ''}</span><span className={`stack-cell ${char === 'Z0' ? 'stack-bottom' : ''}`}>{display(char)}</span><small>{index === 0 ? 'вершина' : char === 'Z0' ? 'дно' : ''}</small></div>)}
              </div>
              {comparing && <p className="matching-pair"><strong>{word[simState.inputIndex] === undefined ? 'Нет входного символа' : display(word[simState.inputIndex])}</strong> ↔ <strong>{display(simState.stack[0])}</strong><br /><small>символ слова ↔ символ шаблона</small></p>}
            </section>
            <section className="logs-panel"><h3>Журнал переходов</h3><div className="simulation-logs" ref={logsRef}>{simState.logs.map((log, index) => <div key={index}>{log}</div>)}</div></section>
          </div>
          {!active && <CompletionPanel key={attempt?.id} saved={saved} passed={grade.passed} score={grade.score} maxScore={grade.maxScore} canEdit={!pendingResult} onEdit={returnToEditing} />}
        </div>
      )}
      {failed && <FailureDialog saved={saved} score={grade.score} maxScore={grade.maxScore} error={error} onRetry={pendingResult ? retrySave : undefined} onBack={onBack} />}
      {!failed && error && <p className="error-text" role="alert">{error}</p>}
      {!failed && pendingResult && <button onClick={retrySave}>Повторить сохранение результата</button>}
    </div>
  );
}
