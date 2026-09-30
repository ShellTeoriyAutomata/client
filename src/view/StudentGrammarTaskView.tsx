import React, { useState } from 'react';
import type { Task, LogSection } from '../models/types';
import { ResultController } from '../controllers/ResultController';
import { AuthController } from '../controllers/AuthController';

interface StudentGrammarTaskViewProps {
  task: Task;
  onBack: () => void;
}

const StudentGrammarTaskView: React.FC<StudentGrammarTaskViewProps> = ({ task, onBack }) => {
  const [step, setStep] = useState<number>(1);
  const [nonTerminalsRaw, setNonTerminalsRaw] = useState('');
  const [parsedNonTerminals, setParsedNonTerminals] = useState<string[]>([]);
  const [terminalsInputs, setTerminalsInputs] = useState<Record<string, string>>({});
  const [templateInput, setTemplateInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]); // Logs for loading phase
  const [comparisonLogs, setComparisonLogs] = useState<string[]>([]); // Logs for comparison phase
  const [showComparisonLogs, setShowComparisonLogs] = useState(false); // Show after table check

  // Structured logs for Teacher
  const [step1Logs, setStep1Logs] = useState<string[]>([]);
  const [step2Logs, setStep2Logs] = useState<string[]>([]);
  const [step3Logs, setStep3Logs] = useState<string[]>([]);

  const addError = (msg: string, currentStep: number) => {
      setMistakeCount(prev => prev + 1);
      const logMsg = `[${new Date().toLocaleTimeString()}] Ошибка: ${msg}`;
      setErrorLog(prev => [...prev, logMsg]);
      setError(msg);

      if (currentStep === 1) {
          setStep1Logs(prev => [...prev, logMsg]);
      } else if (currentStep === 2) {
          setStep2Logs(prev => [...prev, logMsg]);
      } else {
          setStep3Logs(prev => [...prev, logMsg]);
      }
  };

  const validateNonTerminal = (symbol: string): boolean => {
    const s = symbol.trim();
    if (!s) return false;
    // Только английские буквы и цифры, начинается с буквы
    const regex = /^[A-Za-z][A-Za-z0-9*+\-']*$/;
    return regex.test(s);
  };

  const validateTerminalPart = (part: string): boolean => {
    const s = part.trim();
    if (!s) return false;
    // Format: "X" or "X-Y". Allowed: Russian chars, Digits.
    const charClass = "[А-Яа-яЁё0-9]";
    const rangeRegex = new RegExp(`^${charClass}-${charClass}$`);
    const singleRegex = new RegExp(`^${charClass}$`);
    return singleRegex.test(s) || rangeRegex.test(s);
  };

  const handleStep1Submit = () => {
    setError(null);
    const parts = nonTerminalsRaw.split('\\').map(p => p.trim()).filter(p => p !== '');
    if (parts.length === 0) {
        addError('Не введены нетерминалы', 1);
        return;
    }
    const invalidParts: string[] = [];
    parts.forEach(part => {
        if (!validateNonTerminal(part)) {
            invalidParts.push(part);
        }
    });
    if (invalidParts.length > 0) {
        addError(`Неверные нетерминалы: ${invalidParts.join(', ')}`, 1);
        return;
    }
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
      const invalidFields: string[] = [];

      for (const nt of parsedNonTerminals) {
          const input = terminalsInputs[nt] || '';
          if (!input.trim()) {
              invalidFields.push(`Поле для "${nt}" пустое`);
              continue;
          }
          const parts = input.split('\\').map(p => p.trim()).filter(p => p !== '');
          if (parts.length === 0) {
              invalidFields.push(`Поле для "${nt}" не содержит значений`);
              continue;
          }
          const badParts = parts.filter(p => !validateTerminalPart(p));
          if (badParts.length > 0) {
              invalidFields.push(`В поле "${nt}" ошибки: ${badParts.join(', ')}`);
          }
      }

      if (invalidFields.length > 0) {
          const msg = `Ошибки ввода терминалов:\n${invalidFields.join('\n')}`;
          addError(msg, 2);
          return;
      }

      const successMsg = `[${new Date().toLocaleTimeString()}] Успешный ввод терминалов для всех нетерминалов`;
      const finalLogs = [...step2Logs, successMsg];
      setStep2Logs(finalLogs);

      setStep(3);
  };

  interface TableRow {
      storeSymbol: string;
      inputSymbol: string;
  }

  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  // Use a string key for map "store|input" -> action
  const [userTableAnswers, setUserTableAnswers] = useState<Record<string, string>>({});

  // Пользовательские ошибки с расшифровкой
  interface CustomError {
      name: string;
      description: string;
  }
  const [customErrors, setCustomErrors] = useState<CustomError[]>([]);
  const [newErrorName, setNewErrorName] = useState('');
  const [newErrorDescription, setNewErrorDescription] = useState('');

  const handleStep3Submit = () => {
    setError(null);
    setSuccess(false);

    if (!templateInput.trim()) {
        addError('Шаблон не может быть пустым', 3);
        return;
    }

    if (!wordInput.trim()) {
        addError('Введите проверочное слово', 3);
        return;
    }

    // Tokenize Template and Build Regex
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sortedNTs = [...parsedNonTerminals].sort((a, b) => b.length - a.length);
    const tokenRegex = new RegExp(`(${sortedNTs.map(escapeRegExp).join('|')}|[^])`, 'g');
    const tokens = templateInput.match(tokenRegex) || [];
    
    let regexStr = '^';
    let simTokens: { type: 'NT' | 'T', value: string, regexPart?: string }[] = [];

    for (const token of tokens) {
        if (parsedNonTerminals.includes(token)) {
             const defs = terminalsInputs[token].split('\\').map(s => s.trim()).filter(Boolean);
             const parts = defs.map(d => {
                 if (/^.-.$/.test(d)) return `[${d}]`; // character class like 0-9
                 return escapeRegExp(d);
             });
             const group = `(${parts.join('|')})`;
             regexStr += group;
             simTokens.push({ type: 'NT', value: token, regexPart: group });
        } else {
             regexStr += escapeRegExp(token);
             simTokens.push({ type: 'T', value: token });
        }
    }
    regexStr += '$';
    
    try {
        // Just validate the regex can be created
        new RegExp(regexStr);
    } catch (e) {
        addError('Ошибка при создании проверки шаблона. Проверьте спецсимволы.', 3);
        return;
    }
    
    // === PHASE 1: Loading the Store (Магазин) ===
    // Format: (qN, e, symbol) -> (qN+1, e, next_symbol)
    const loadLogs: string[] = [];
    loadLogs.push('--- Фаза 1: Загрузка магазина ---');
    
    // Build store array from ALL template characters (both T and NT)
    const storeArray: string[] = [];
    for (const token of simTokens) {
        storeArray.push(token.value);
    }
    
    // Generate loading logs
    // Start with Z0
    let qState = 0;
    loadLogs.push(`(q${qState}, ε, Z0) -> (q${qState + 1}, ε, ${storeArray[0] || 'Z0'})`);
    qState++;
    
    // Load each symbol from template (right to left conceptually, but we show left to right)
    for (let i = 0; i < storeArray.length - 1; i++) {
        loadLogs.push(`(q${qState}, ε, ${storeArray[i]}) -> (q${qState}, ε, ${storeArray[i + 1]})`);
    }
    
    // Final transition to reading phase
    if (storeArray.length > 0) {
        loadLogs.push(`(q${qState}, ε, ${storeArray[storeArray.length - 1]}) -> (q${qState + 1}, *, *) [Переход к чтению]`);
    }
    
    setLoadingLogs(loadLogs);
    
    // === Prepare comparison data (but don't show logs yet) ===
    // Build word array - character by character
    const wordArray: string[] = wordInput.split('');
    
    // Collect unique pairs in order of appearance for the table
    const encounteredPairsSet = new Set<string>();
    const orderedPairs: { store: string, input: string }[] = [];
    
    // Add Z0 at the end of store for comparison
    const storeWithZ0 = [...storeArray, 'Z0'];
    // Add ε at the end of word
    const wordWithEpsilon = [...wordArray, 'ε'];
    
    const maxLen = Math.max(storeWithZ0.length, wordWithEpsilon.length);
    
    // Generate comparison logs (will be shown after table is filled correctly)
    const compLogs: string[] = [];
    compLogs.push('');
    compLogs.push('--- Фаза 2: Чтение слова ---');
    
    let compQState = qState + 1;
    let simError = false;
    let errorType = 0;
    
    for (let i = 0; i < maxLen; i++) {
        const storeChar = i < storeWithZ0.length ? storeWithZ0[i] : 'ε';
        const wordChar = i < wordWithEpsilon.length ? wordWithEpsilon[i] : 'ε';
        
        // Add to table if unique
        const pairKey = `${storeChar}|${wordChar}`;
        if (!encounteredPairsSet.has(pairKey)) {
            encounteredPairsSet.add(pairKey);
            orderedPairs.push({ store: storeChar, input: wordChar });
        }
        
        // Generate log entry
        const prevState = compQState;
        const nextState = compQState + 1;
        
        // Check for errors and generate appropriate log
        if (storeChar === 'Z0' && wordChar === 'ε') {
            compLogs.push(`(q${prevState}, ${wordChar}, ${storeChar}) -> (q${nextState}, ε, Z0) [Успех: Конец]`);
            break;
        } else if (storeChar === 'Z0' && wordChar !== 'ε') {
            compLogs.push(`(q${prevState}, ${wordChar}, ${storeChar}) -> ОШИБКА 2: Магазин пуст, а слово нет`);
            simError = true;
            errorType = 2;
            break;
        } else if (storeChar !== 'Z0' && wordChar === 'ε') {
            compLogs.push(`(q${prevState}, ${wordChar}, ${storeChar}) -> ОШИБКА 3: Слово закончилось, а магазин нет`);
            simError = true;
            errorType = 3;
            break;
        } else {
            // Both have characters - check match
            const tokenObj = simTokens[i];
            let match = false;
            
            if (tokenObj && tokenObj.type === 'NT') {
                // Check if wordChar is valid for this NT
                const defs = terminalsInputs[tokenObj.value].split('\\').map(s => s.trim());
                for (const d of defs) {
                    if (/^.-.$/.test(d)) {
                        const regex = new RegExp(`^[${d}]$`);
                        if (regex.test(wordChar)) {
                            match = true;
                            break;
                        }
                    } else if (d === wordChar) {
                        match = true;
                        break;
                    }
                }
            } else {
                // Terminal - direct char match
                match = (storeChar === wordChar);
            }
            
            if (match) {
                compLogs.push(`(q${prevState}, ${wordChar}, ${storeChar}) -> (q${nextState}, ${wordChar}, ${storeChar}) [pop]`);
                compQState++;
            } else {
                compLogs.push(`(q${prevState}, ${wordChar}, ${storeChar}) -> ОШИБКА 1: Несоответствие`);
                simError = true;
                errorType = 1;
                break;
            }
        }
    }
    
    if (simError) {
        compLogs.push(`--- Симуляция завершена с Ошибкой ${errorType} ---`);
    } else {
        compLogs.push('--- Успешное завершение ---');
    }
    
    setComparisonLogs(compLogs);
    setShowComparisonLogs(false); // Hide until table is correctly filled
    
    // Generate Table Rows from orderedPairs (in order of appearance)
    const newRows: TableRow[] = orderedPairs.map(p => ({
        storeSymbol: p.store,
        inputSymbol: p.input
    }));
    
    setTableRows(newRows);

    setStep(4);
  };

  const handleTableInput = (rowKey: string, val: string) => {
      setUserTableAnswers(prev => ({
          ...prev,
          [rowKey]: val
      }));
  };

  const handleStep4Submit = () => {
      setError(null);
      const invalidFields: string[] = [];

      // Проверка, что хотя бы одна ошибка добавлена
      if (customErrors.length === 0) {
          addError('Добавьте хотя бы одну ошибку в конструкторе ошибок', 4);
          return;
      }

      // Validate Table Answers
      tableRows.forEach(row => {
          const key = `${row.storeSymbol}|${row.inputSymbol}`;
          const action = userTableAnswers[key];
          
          if (!action) {
              invalidFields.push(`Не выбрано действие для пары (${row.storeSymbol}, ${row.inputSymbol})`);
              return;
          }

          // Validation Logic
          // Case 1: Match (A, A) - должно быть pop
          if (row.storeSymbol === row.inputSymbol && row.storeSymbol !== 'Z0') {
               if (action !== 'pop') {
                   invalidFields.push(`(${row.storeSymbol}, ${row.inputSymbol}): Ожидается 'pop'.`);
               }
          }
          // Case 2: (Z0, Char) -> Store Empty, Input Not Empty - должна быть ошибка
          else if (row.storeSymbol === 'Z0' && row.inputSymbol !== 'ε') {
               if (action === 'pop' || action === 'OK' || action === '-') {
                    invalidFields.push(`(${row.storeSymbol}, ${row.inputSymbol}): Необходимо выбрать ошибку (магазин пуст, а слово нет).`);
               }
          }
          // Case 3: (Char, Empty) -> Store Not Empty, Input Empty - должна быть ошибка
          else if (row.storeSymbol !== 'Z0' && row.inputSymbol === 'ε') {
               if (action === 'pop' || action === 'OK' || action === '-') {
                   invalidFields.push(`(${row.storeSymbol}, ${row.inputSymbol}): Необходимо выбрать ошибку (слово закончилось, а магазин нет).`);
               }
          }
          // Case 4: (Z0, Empty) -> Success
          else if (row.storeSymbol === 'Z0' && row.inputSymbol === 'ε') {
                if (action !== 'OK') {
                    invalidFields.push(`(${row.storeSymbol}, ${row.inputSymbol}): Неверный финал. Ожидается 'OK'.`);
                }
          }
      });

      if (invalidFields.length > 0) {
          const msg = `Ошибки в таблице:\n${invalidFields.join('\n')}`;
          addError(msg, 4);
          return;
      }

      // Table is correct - show comparison logs
      setShowComparisonLogs(true);
      setStep3Logs(prev => [...prev, ...loadingLogs, ...comparisonLogs]);

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
                items: step3Logs,
                isError: step3Logs.some(l => l.includes('Ошибка'))
            },
            {
                title: "Этап 4: Таблица переходов",
                // Combine simulation logs + "Table Validated"
                items: ["Таблица переходов заполнена верно"],
                isError: false
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
            inputWord: `NT: ${nonTerminalsRaw} | T: ${JSON.stringify(terminalsInputs)} | Template: ${templateInput} | CheckWord: ${wordInput}`,
            logs: resultLogs,
            completedAt: new Date().toISOString()
        });
        setSuccess(true);
     }
  };

  if (success) {
      return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
             <button onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Назад к списку</button>
             
             <div style={{ 
                padding: '2rem', 
                backgroundColor: '#fff', 
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
                                {templateInput}
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
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
      <button onClick={onBack} style={{ marginBottom: '1rem' }}>&larr; Назад</button>
      
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      
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
                Введите нетерминальные символы (разделитель \). Только английские буквы:
                </label>
                <input 
                type="text" 
                value={nonTerminalsRaw}
                onChange={(e) => setNonTerminalsRaw(e.target.value)}
                placeholder="Например: X\A\B\NUM"
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
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                Введите допустимые значения для каждого нетерминала через знак <code>\</code>.
                <br/>Допустимы диапазоны (например <code>1-9</code>, <code>а-я</code>) или одиночные символы (<code>а</code>, <code>Б</code>).
                Только русские буквы и цифры.
            </p>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                {parsedNonTerminals.map(nt => (
                    <div key={nt} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '80px', fontWeight: 'bold', textAlign: 'right' }}>{nt}</div>
                        <input 
                            type="text"
                            value={terminalsInputs[nt] || ''}
                            onChange={(e) => handleTerminalInputChange(nt, e.target.value)}
                            placeholder="Например: 1-9\а-б"
                            style={{ flex: 1, padding: '0.5rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                        />
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

            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                Создайте шаблон, используя определенные вами нетерминалы ({parsedNonTerminals.join(', ')}) и любые другие символы.
                <br/>Например: <code>Адрес: УЛ, дом Д</code> (если УЛ и Д ваши нетерминалы).
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
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 0 }}>Введите слово, которое должно соответствовать этому шаблону (все нетерминалы заменены на валидные значения).</p>
                <textarea 
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    placeholder="Введите слово для проверки..."
                    style={{ width: '100%', minHeight: '80px', padding: '0.5rem', fontSize: '1rem', backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
                />
            </div>

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
        <div>
            <h3>Шаг 4: Симуляция и Таблица переходов</h3>
            
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#333', color: '#fff', borderRadius: '4px', border: '1px solid #555' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <strong>Введенный шаблон:</strong>
                    <div style={{ fontFamily: 'monospace', marginTop: '0.25rem', color: '#81d4fa' }}>{templateInput}</div>
                </div>
                
                <strong>Справочник нетерминалов:</strong>
                <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                    {parsedNonTerminals.map(nt => (
                        <React.Fragment key={nt}>
                            <div style={{ fontWeight: 'bold', textAlign: 'right', color: '#a5d6a7' }}>{nt}</div>
                            <div>&rarr; {terminalsInputs[nt]}</div>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem', background: '#000', color: '#fff', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', maxHeight: '300px', overflowY: 'auto' }}>
                <strong>Фаза 1: Загрузка магазина</strong>
                {loadingLogs.map((log, i) => (
                    <div key={i} style={{ color: log.includes('---') ? '#81d4fa' : '#fff' }}>{log}</div>
                ))}
                
                {showComparisonLogs && (
                    <>
                        <div style={{ marginTop: '1rem' }}></div>
                        <strong>Фаза 2: Чтение слова</strong>
                        {comparisonLogs.map((log, i) => (
                            <div key={`comp-${i}`} style={{ 
                                color: log.includes('ОШИБКА') ? '#ff8a80' : 
                                       log.includes('Успех') || log.includes('Успешное') ? '#a5d6a7' : 
                                       log.includes('---') ? '#81d4fa' : '#fff' 
                            }}>{log}</div>
                        ))}
                    </>
                )}
                
                {!showComparisonLogs && (
                    <div style={{ marginTop: '1rem', color: '#ffcc80', fontStyle: 'italic' }}>
                        Заполните таблицу правильно, чтобы увидеть фазу чтения слова.
                    </div>
                )}
            </div>

            <h4>Таблица уникальных комбинаций</h4>
            
            {/* Раздел для добавления пользовательских ошибок */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #444' }}>
                <h4 style={{ marginTop: 0, color: '#81d4fa' }}>Конструктор ошибок</h4>
                <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1rem' }}>
                    Добавьте типы ошибок с их расшифровкой. Эти ошибки будут доступны для выбора в таблице.
                </p>
                
                {/* Список существующих ошибок */}
                {customErrors.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        <strong style={{ color: '#a5d6a7' }}>Ваши ошибки:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {customErrors.map((err, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: '#2d3748',
                                    borderRadius: '4px',
                                    border: '1px solid #4a5568'
                                }}>
                                    <div>
                                        <span style={{ color: '#ff9800', fontWeight: 'bold' }}>{err.name}</span>
                                        <span style={{ color: '#888', margin: '0 0.5rem' }}>—</span>
                                        <span style={{ color: '#ccc' }}>{err.description}</span>
                                    </div>
                                    <button
                                        onClick={() => setCustomErrors(prev => prev.filter((_, i) => i !== idx))}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ff6b6b',
                                            cursor: 'pointer',
                                            fontSize: '1.2rem',
                                            padding: '0 0.25rem',
                                            lineHeight: 1
                                        }}
                                        title="Удалить"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Форма добавления новой ошибки */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '0 0 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Название</label>
                        <input
                            type="text"
                            value={newErrorName}
                            onChange={(e) => setNewErrorName(e.target.value)}
                            placeholder="Ошибка 1"
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: '#000',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Расшифровка</label>
                        <input
                            type="text"
                            value={newErrorDescription}
                            onChange={(e) => setNewErrorDescription(e.target.value)}
                            placeholder="Несоответствие символов"
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: '#000',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px'
                            }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && newErrorName.trim() && newErrorDescription.trim()) {
                                    setCustomErrors(prev => [...prev, { name: newErrorName.trim(), description: newErrorDescription.trim() }]);
                                    setNewErrorName('');
                                    setNewErrorDescription('');
                                }
                            }}
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (newErrorName.trim() && newErrorDescription.trim()) {
                                setCustomErrors(prev => [...prev, { name: newErrorName.trim(), description: newErrorDescription.trim() }]);
                                setNewErrorName('');
                                setNewErrorDescription('');
                            }
                        }}
                        style={{
                            backgroundColor: '#4caf50',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            height: 'fit-content'
                        }}
                    >
                        Добавить
                    </button>
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', color: '#fff', backgroundColor: '#222' }}>
                <thead>
                    <tr style={{ background: '#444' }}>
                        <th style={{ border: '1px solid #555', padding: '8px' }}>VT</th>
                        <th style={{ border: '1px solid #555', padding: '8px' }}>T(Input)</th>
                        <th style={{ border: '1px solid #555', padding: '8px' }}>Действие</th>
                    </tr>
                </thead>
                <tbody>
                    {tableRows.map((row, idx) => {
                         const key = `${row.storeSymbol}|${row.inputSymbol}`;
                         return (
                            <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                                <td style={{ border: '1px solid #555', padding: '8px', textAlign: 'center' }}>
                                    "{row.storeSymbol}"
                                </td>
                                <td style={{ border: '1px solid #555', padding: '8px', textAlign: 'center' }}>
                                    "{row.inputSymbol}"
                                </td>
                                <td style={{ border: '1px solid #555', padding: '8px' }}>
                                    <select 
                                        value={userTableAnswers[key] || ''}
                                        onChange={(e) => handleTableInput(key, e.target.value)}
                                        style={{ width: '100%', backgroundColor: '#000', color: '#fff', border: '1px solid #555', padding: '4px' }}
                                    >
                                        <option value="">Выберите...</option>
                                        <option value="pop">pop (Сдвиг)</option>
                                        <option value="-">- (Прочерк)</option>
                                        {customErrors.length > 0 && (
                                            <optgroup label="Ошибки">
                                                {customErrors.map((err, errIdx) => (
                                                    <option key={errIdx} value={err.name}>{err.name} - {err.description}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div style={{ display: 'flex', gap: '1rem' }}>
                 <button 
                    onClick={() => setStep(3)}
                    style={{ backgroundColor: '#e0e0e0', color: 'black', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Назад
                </button>
                <button 
                    onClick={handleStep4Submit}
                    style={{ backgroundColor: '#2e7d32', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Проверить и Сохранить
                </button>
            </div>
        </div>
       )}

    </div>
  );
};

export default StudentGrammarTaskView;
