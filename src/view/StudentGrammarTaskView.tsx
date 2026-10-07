import React, { useState } from 'react';
import type { Task, LogSection } from '../models/types';
import { ResultController } from '../controllers/ResultController';
import { AuthController } from '../controllers/AuthController';
import { getNonTerminalErrors, getTerminalErrors, resolveGrammarInputs, simulateGrammar, getTransitionErrors, getGrammarActions } from '../utils/grammarValidation';
import type { GrammarTransition } from '../utils/grammarValidation';

interface StudentGrammarTaskViewProps {
  task: Task;
  onBack: () => void;
}

/** Проводит студента через ввод грамматики, симуляцию и проверку таблицы переходов. */
const StudentGrammarTaskView: React.FC<StudentGrammarTaskViewProps> = ({ task, onBack }) => {
  const [step, setStep] = useState<number>(1);
  const [nonTerminalsRaw, setNonTerminalsRaw] = useState('');
  const [parsedNonTerminals, setParsedNonTerminals] = useState<string[]>([]);
  const [terminalsInputs, setTerminalsInputs] = useState<Record<string, string>>({});
  const [wordAccepted, setWordAccepted] = useState(false);
  const [templateInput, setTemplateInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]); // Logs for loading phase
  const [comparisonLogs, setComparisonLogs] = useState<string[]>([]); // Logs for comparison phase

  // Structured logs for Teacher
  const [step1Logs, setStep1Logs] = useState<string[]>([]);
  const [step2Logs, setStep2Logs] = useState<string[]>([]);
  const [step3Logs, setStep3Logs] = useState<string[]>([]);
  const [step4Logs, setStep4Logs] = useState<string[]>([]);

  const addErrors = (messages: string[], currentStep: number, showMessage = true) => {
      setMistakeCount(prev => prev + messages.length);
      const timestamp = new Date().toLocaleTimeString();
      const logMessages = messages.map(msg => `[${timestamp}] Ошибка: ${msg}`);
      setErrorLog(prev => [...prev, ...logMessages]);
      if (showMessage) setError(messages.join('\n'));

      if (currentStep === 1) {
          setStep1Logs(prev => [...prev, ...logMessages]);
      } else if (currentStep === 2) {
          setStep2Logs(prev => [...prev, ...logMessages]);
      } else if (currentStep === 3) {
          setStep3Logs(prev => [...prev, ...logMessages]);
      } else {
          setStep4Logs(prev => [...prev, ...logMessages]);
      }
  };


  const handleStep1Submit = () => {
    setError(null);
    const errors = getNonTerminalErrors(nonTerminalsRaw);
    if (errors.length > 0) {
        addErrors(errors, 1);
        return;
    }
    const parts = [...new Set(nonTerminalsRaw.split('\\').map(p => p.trim()).filter(Boolean))];
    // Success Step 1
    setStep1Logs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Успешный ввод нетерминалов: ${parts.join(', ')}`]);

    const initTerminals: Record<string, string> = {};
    parts.forEach(nt => {
        initTerminals[nt] = terminalsInputs[nt] || '';
    });
    setParsedNonTerminals(parts);
    setTerminalsInputs(initTerminals);
    setStep(2);
  };

  const handleTerminalInputChange = (nt: string, val: string) => {
      setTerminalsInputs(prev => ({ ...prev, [nt]: val }));
  };

  const handleStep2Submit = () => {
      setError(null);
      setSuccess(false);
      const errors = getTerminalErrors(parsedNonTerminals, terminalsInputs);
      if (errors.length > 0) {
          addErrors(errors, 2);
          return;
      }

      const successMsg = `[${new Date().toLocaleTimeString()}] Успешный ввод терминалов для всех нетерминалов`;
      const finalLogs = [...step2Logs, successMsg];
      setStep2Logs(finalLogs);

      setStep(3);
  };

  const [tableRows, setTableRows] = useState<GrammarTransition[]>([]);
  const [userTableAnswers, setUserTableAnswers] = useState<Record<string, string>>({});
  const [transitionIndex, setTransitionIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState('');
  const [templateTokens, setTemplateTokens] = useState<string[]>([]);
  const [wordSymbols, setWordSymbols] = useState<string[]>([]);

  const handleStep3Submit = () => {
    setError(null);
    setSuccess(false);
    const errors = [
        ...(!templateInput.trim() ? ['Шаблон не может быть пустым'] : []),
        ...(!wordInput ? ['Введите проверочное слово или _ для epsilon'] : []),
    ];
    if (errors.length) {
        addErrors(errors, 3);
        return;
    }
    const simulation = simulateGrammar(templateInput, wordInput, parsedNonTerminals, terminalsInputs);
    if (simulation.inputErrors.length) addErrors(simulation.inputErrors, 3, false);
    else setStep3Logs(prev => [...prev, 'Проверочное слово соответствует грамматике']);
    setWordAccepted(simulation.accepted);
    setLoadingLogs(simulation.loadingLogs);
    setComparisonLogs(simulation.comparisonLogs);
    setTableRows(simulation.rows);
    setUserTableAnswers({});
    setTransitionIndex(0);
    setSelectedAction('');
    setTemplateTokens(simulation.templateTokens);
    setWordSymbols(simulation.wordSymbols);
    setStep(4);
  };

  const handleCheckTransition = () => {
      const row = tableRows[transitionIndex];
      if (!row) return;
      const errors = getTransitionErrors([row], { [row.id]: selectedAction });
      if (errors.length) {
          addErrors(errors, 4);
          return;
      }
      setError(null);
      setUserTableAnswers(prev => ({ ...prev, [row.id]: selectedAction }));
      setStep4Logs(prev => [...prev,
          `${row.id}: (${row.inputSymbol}, ${row.storeSymbol}) [${row.context}] → ${selectedAction} (${row.expectedAction}). ${row.message}`]);
      setTransitionIndex(prev => prev + 1);
      setSelectedAction('');
  };

  const handleStep4Submit = () => {
      if (transitionIndex !== tableRows.length || !tableRows.length) return;
      const errors = getTransitionErrors(tableRows, userTableAnswers);
      if (errors.length) {
          addErrors(errors, 4);
          return;
      }
      setError(null);

      // Success
      const student = AuthController.getCurrentStudent();
     if (student) {
        const resultLogs: (string | LogSection)[] = [
            {
                title: "Этап 1: Нетерминалы",
                items: step1Logs,
                isError: step1Logs.some(l => l.includes('Ошибка')) 
            },
            {
                title: "Этап 2: Терминалы",
                items: step2Logs,
                isError: step2Logs.some(l => l.includes('Ошибка'))
            },
            {
                title: "Этап 3: Шаблон",
                items: [...step3Logs, ...loadingLogs],
                isError: step3Logs.some(l => l.includes('Ошибка'))
            },
            {
                title: "Этап 4: Пошаговая проверка",
                // Сохраняем только проверенные студентом переходы и итог распознавания.
                items: [...step4Logs, "Все переходы проверены верно", ...comparisonLogs],
                isError: step4Logs.some(log => log.includes('Ошибка:'))
            },
            "Задание выполнено успешно"
        ];

        ResultController.saveResult({
            id: Date.now().toString(),
            studentId: student.id,
            studentName: student.fio,
            taskId: task.id,
            taskTitle: task.title,
            status: 'success',
            score: 5,
            mistakeCount,
            errorHistory: errorLog,
            wordAccepted,
            inputWord: `NT: ${nonTerminalsRaw} | T: ${JSON.stringify(terminalsInputs)} | Template: ${resolvedInputs.template} | CheckWord: ${resolvedInputs.input}`,
            logs: resultLogs,
            completedAt: new Date().toISOString()
        });
        setSuccess(true);
     }
  };

  const resolvedInputs = resolveGrammarInputs(templateInput, wordInput, parsedNonTerminals);

  const currentTransition = tableRows[transitionIndex];
  const checkedRows = tableRows.slice(0, transitionIndex);
  const lastChecked = checkedRows.at(-1);
  const simulationComplete = tableRows.length > 0 && !currentTransition;

  const renderTape = (symbols: string[], index: number, pointerLabel: string, testId: string) => (
      <div className="grammar-tape" data-testid={testId}>
          {symbols.map((symbol, position) => (
              <span key={position} className={`grammar-cell${position === index ? ' is-current' : ''}`}
                  aria-current={position === index ? 'step' : undefined}>
                  {position === index && <span className="grammar-pointer" aria-label={pointerLabel} data-index={position}>↓</span>}
                  <span>{symbol === ' ' ? '␠' : symbol === '_' ? 'ε' : symbol}</span>
              </span>
          ))}
      </div>
  );

  if (success) {
      return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
             <button onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Назад к списку</button>
             
             <div style={{ 
                padding: '2rem', 
                backgroundColor: '#fff', 
                color: '#222',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ color: '#2e7d32', marginTop: 0 }}>🎉 Задание выполнено!</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '2rem 0' }}>
                    
                    <div>
                        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>Результаты</h3>
                        <div style={{ marginBottom: '1rem' }}>
                            <strong>Количество ошибок:</strong> 
                            <span style={{ 
                                marginLeft: '0.5rem', 
                                color: mistakeCount > 0 ? '#d32f2f' : '#2e7d32',
                                fontWeight: 'bold'
                            }}>
                                {mistakeCount}
                            </span>
                        </div>
                        
                        <p><strong>Проверочное слово:</strong> {wordAccepted ? 'принято' : 'отклонено: ошибки верно определены в таблице'}</p>
                        <div>
                            <strong>Итоговая грамматика:</strong>
                            <div style={{ 
                                marginTop: '0.5rem',
                                padding: '1rem',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                fontFamily: 'monospace'
                            }}>
                                {parsedNonTerminals.map(nt => (
                                    <div key={nt}>
                                        {nt} &rarr; {terminalsInputs[nt]}
                                    </div>
                                ))}
                            </div>
                        </div>

                         <div style={{ marginTop: '1rem' }}>
                            <strong>Введенный шаблон:</strong>
                            <div style={{ 
                                marginTop: '0.5rem',
                                padding: '1rem',
                                backgroundColor: '#e3f2fd',
                                borderRadius: '4px',
                                fontFamily: 'monospace'
                            }}>
                                {resolvedInputs.template}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>История ошибок</h3>
                        {errorLog.length === 0 ? (
                            <div style={{ color: '#888', fontStyle: 'italic' }}>Ошибок не было. Отличная работа!</div>
                        ) : (
                            <ul style={{ paddingLeft: '1.2rem', color: '#d32f2f' }}>
                                {errorLog.map((log, idx) => (
                                    <li key={idx} style={{ marginBottom: '0.5rem' }}>
                                        {log}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    backgroundColor: '#e8f5e9', 
                    color: '#1b5e20',
                    borderRadius: '4px',
                    textAlign: 'center'
                }}>
                  Результат сохранен в систему.
                </div>
            </div>
        </div>
      );
  }

  return (
    <div style={{ maxWidth: step === 4 ? '1100px' : '700px', width: '100%', margin: '0 auto', textAlign: 'left' }}>
      <button onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Назад</button>
      
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <p role="status" aria-live="polite"><strong>Количество ошибок:</strong> {mistakeCount}</p>
      
      {error && (
        <div style={{ 
            marginBottom: '1rem', 
            padding: '1rem', 
            backgroundColor: '#ffcdd2', 
            color: '#b71c1c',
            borderRadius: '4px',
            border: '1px solid #e57373',
            whiteSpace: 'pre-line' 
        }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div>
            <h3>Шаг 1: Ввод нетерминалов</h3>
            <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Введите нетерминальные символы (разделитель \). Только заглавные английские буквы (A–Z):
                <span style={{ display: 'block' }}>Количество нетерминалов не ограничено. Каждый можно использовать в шаблоне сколько угодно раз.</span>
                </label>
                <input 
                type="text" 
                value={nonTerminalsRaw}
                onChange={(e) => setNonTerminalsRaw(e.target.value)}
                placeholder="Например: A\B\C\NUM"
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                />
            </div>
            <button 
                onClick={handleStep1Submit}
                style={{ backgroundColor: '#1976d2', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                Далее
            </button>
        </div>
      )}

      {step === 2 && (
        <div>
            <h3>Шаг 2: Ввод терминалов</h3>
            <p style={{ fontSize: '0.9rem', color: '#bbb' }}>
                Введите допустимые значения для каждого нетерминала через знак <code>\</code>.
                <br/>Русские буквы любого регистра: одиночные символы (<code>а</code>, <code>Б</code>, <code>Ё</code>) или диапазоны (<code>а-я</code>, <code>А-Я</code>).
                Границы диапазона должны быть одного регистра и идти в алфавитном порядке. Буква Ё включается в диапазоны.
                <br/>Для номеров разрешены цифры и диапазон <code>0-9</code>. Символ <code>_</code> означает epsilon (пустое значение), а не пробел.
                <br/>Одно вхождение нетерминала соответствует одному символу или epsilon и создаёт отдельный переход.
                Для обоих регистров в одном нетерминале задайте <code>а-я\А-Я</code>.
            </p>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                {parsedNonTerminals.map(nt => (
                    <div key={nt} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '80px', fontWeight: 'bold', textAlign: 'right' }}>{nt}</div>
                        <input 
                            type="text"
                            aria-label={`Терминалы ${nt}`}
                            value={terminalsInputs[nt] || ''}
                            onChange={(e) => handleTerminalInputChange(nt, e.target.value)}
                            placeholder="Например: а-я\Б\Ё"
                            style={{ flex: 1, minWidth: 0, padding: '0.5rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                        />
                        <button
                            aria-label={`Русские буквы обоих регистров ${nt}`}
                            onClick={() => handleTerminalInputChange(nt, 'а-я\\А-Я')}
                        >а-я и А-Я</button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                    onClick={() => setStep(1)}
                    style={{ backgroundColor: '#e0e0e0', color: 'black', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Назад
                </button>
                <button 
                    onClick={handleStep2Submit}
                    style={{ backgroundColor: '#1976d2', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Далее
                </button>
            </div>
        </div>
      )}

      {step === 3 && (
        <div>
            <h3>Шаг 3: Создание шаблона</h3>
            
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#000', color: '#fff', borderRadius: '4px', border: '1px solid #444' }}>
                <strong>Справочник ваших нетерминалов:</strong>
                <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem' }}>
                    {parsedNonTerminals.map(nt => (
                        <React.Fragment key={nt}>
                            <div style={{ fontWeight: 'bold', textAlign: 'right', color: '#a5d6a7' }}>{nt}</div>
                            <div>&rarr; {terminalsInputs[nt]}</div>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#bbb' }}>
                Создайте шаблон, используя определенные вами нетерминалы ({parsedNonTerminals.join(', ')}) и буквальные разделители.
                <br/>Повторяйте нетерминал для каждого символа. Улица содержит 5–10 русских букв любого регистра, дом — 3 цифры, квартира — 2 цифры. Символ _ ничего не добавляет.
                <br/>Если A = а-я, B = А-Я, C = 0-9, D = 0-9: <code>ул. BAAAA, д. CCC, кв. DD</code> → <code>ул. Лепсе, д. 444, кв. 52</code>.
                <br/>Можно поменять адрес и последовательность нетерминалов местами: приложение распознает их автоматически.
            </p>
            
            <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Шаблон:</label>
                <textarea 
                    value={templateInput}
                    onChange={(e) => setTemplateInput(e.target.value)}
                    placeholder="Введите ваш шаблон..."
                    style={{ width: '100%', minHeight: '80px', padding: '0.5rem', fontSize: '1rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Проверочное слово:</label>
                <p style={{ fontSize: '0.8rem', color: '#bbb', marginTop: 0 }}>Введите слово для проверки. Можно вводить короткие и длинные значения, чтобы проверить ошибки. _ — epsilon; пробел вводится обычной клавишей пробела.</p>
                <textarea 
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    placeholder="Введите слово для проверки..."
                    style={{ width: '100%', minHeight: '80px', padding: '0.5rem', fontSize: '1rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                />
            </div>

            {resolvedInputs.swapped && <p>Шаблон распознан в поле «Проверочное слово», адрес — в поле «Шаблон».</p>}

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                    onClick={() => setStep(2)}
                    style={{ backgroundColor: '#e0e0e0', color: 'black', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Назад
                </button>
                <button 
                    onClick={handleStep3Submit}
                    style={{ backgroundColor: '#1976d2', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                     Симуляция
                </button>
            </div>
        </div>
      )}

      {step === 4 && (
        <div className="grammar-simulation">
            <h3>Шаг 4: Пошаговая проверка</h3>
            <p>Оцените текущую триаду (состояние, символ слова, вершина магазина).
                Выберите pop, если сопоставление верно, или одну из трёх готовых ошибок.
                Указатели сдвигаются только после верного ответа.</p>
            <p className="grammar-progress" aria-live="polite">Проверено переходов: {transitionIndex} из {tableRows.length}</p>

            <div className="grammar-board">
                <div className="grammar-rail">
                    <strong>Шаблон</strong>
                    {renderTape([...templateTokens, 'ε'], currentTransition?.templateIndex ?? templateTokens.length,
                        'Указатель шаблона', 'grammar-template')}
                </div>
                <div className="grammar-rail">
                    <strong>Проверочное слово</strong>
                    {renderTape([...wordSymbols, 'ε'], currentTransition?.inputOffset ?? wordSymbols.length,
                        'Указатель слова', 'grammar-word')}
                </div>
                <div className="grammar-rail">
                    <strong>Магазин <small>вершина слева</small></strong>
                    {renderTape(currentTransition?.stack ?? ['ε'], 0, 'Указатель магазина', 'grammar-stack')}
                </div>
                <p className="grammar-legend">↓ — текущая позиция; ␠ — пробел; ε — пустой символ; Z0 — дно магазина.
                    Epsilon не сдвигает указатель слова. На границе поля ε означает его конец.
                    После верного определения ошибки поля проверка продолжится со следующего поля адреса.</p>
            </div>

            {lastChecked && <p className="grammar-feedback" aria-live="polite">
                {lastChecked.id}: верно. {lastChecked.message}
            </p>}

            {currentTransition ? (
                <div className="grammar-current">
                    <div data-testid="current-triad">
                        <h4>Текущая триада</h4>
                        <div className="grammar-triad" aria-live="polite">({currentTransition.id}, "{currentTransition.inputSymbol}", "{currentTransition.storeSymbol}")</div>
                        <p>{currentTransition.context}</p>
                    </div>
                    <label htmlFor="grammar-action">Действие:</label>
                    <div className="grammar-action-controls">
                        <select id="grammar-action" aria-label="Действие текущей триады" value={selectedAction}
                            onChange={event => setSelectedAction(event.target.value)}>
                            <option value="">Выберите действие...</option>
                            {getGrammarActions().map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
                        </select>
                        <button onClick={handleCheckTransition}>Проверить переход</button>
                    </div>
                </div>
            ) : (
                <div className="grammar-complete" aria-live="polite">
                    <strong>Все переходы проверены.</strong>
                    <p>{wordAccepted ? 'Слово принято.' : 'Слово отклонено. Вы верно определили ошибки.'}</p>
                    <button onClick={handleStep4Submit}>Завершить и сохранить</button>
                </div>
            )}

            <details className="grammar-history" open={simulationComplete}>
                <summary>Проверенные переходы ({transitionIndex})</summary>
                <div data-testid="transition-history">
                    {checkedRows.map(row => <p key={row.id}>
                        ({row.id}, "{row.inputSymbol}", "{row.storeSymbol}") → {getGrammarActions().find(action => action.value === userTableAnswers[row.id])?.label}
                        <br/><small>{row.context}: {row.message}</small>
                    </p>)}
                </div>
            </details>
            <details className="grammar-history">
                <summary>Справочник нетерминалов и загрузка магазина</summary>
                {parsedNonTerminals.map(nt => <p key={nt}>{nt} → {terminalsInputs[nt]}</p>)}
                {loadingLogs.map((log, index) => <div key={index}>{log}</div>)}
            </details>
            <button onClick={() => { setError(null); setStep(3); }} style={{ marginTop: '1rem' }}>Назад</button>
        </div>
      )}

    </div>
  );
};

export default StudentGrammarTaskView;
