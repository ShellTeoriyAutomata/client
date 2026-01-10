import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Task } from '../models/types';
import { SimulationController, type SimulationState } from '../controllers/SimulationController';
import { AuthController } from '../controllers/AuthController';
import { ResultController } from '../controllers/ResultController';

interface StudentTaskViewProps {
  task: Task;
  onBack: () => void;
}

const StudentTaskView: React.FC<StudentTaskViewProps> = ({ task, onBack }) => {
  const [inputWord, setInputWord] = useState('');
  
  // Controller instance - use useMemo to ensure it's created only when task changes
  const controller = useMemo(() => new SimulationController(task), [task]);
  
  const [simState, setSimState] = useState<SimulationState>(() => controller.getState());
  const [loadingIndex, setLoadingIndex] = useState<number>(-1);

  // Sync state when controller changes (e.g. task changed)
  useEffect(() => {
      setSimState(controller.getState());
  }, [controller]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simState.logs]);

  const handleLoadStep = () => {
    if (loadingIndex >= 0) {
      const char = inputWord[loadingIndex];
      const remainingAfter = inputWord.substring(0, loadingIndex);
      
      controller.loadChar(char, remainingAfter);
      
      const nextIndex = loadingIndex - 1;
      setLoadingIndex(nextIndex);
      
      if (nextIndex < 0) {
        controller.setStatus('running');
        controller.addLog('Слово загружено. Нажмите ПРОБЕЛ для выполнения такта.');
      }
      setSimState(controller.getState());
    }
  };

  const handleStart = () => {
    if (!inputWord) return;
    
    controller.start(inputWord);
    setSimState(controller.getState());
    setLoadingIndex(inputWord.length - 1);
    controller.addLog('Нажмите ПРОБЕЛ для загрузки символа в магазин.');
  };

  const handleTick = () => {
    controller.tick();
    setSimState(controller.getState());
  };

  // Destructure state for easier usage in render
  const { stack, templateIndex, status, logs, errorMessage } = simState;

  // Save result on completion (success or error)
  useEffect(() => {
    if (status === 'success' || status === 'error') {
        const student = AuthController.getCurrentStudent();
        if (student) {
            const result = {
                id: Date.now().toString(),
                studentId: student.id,
                studentName: student.fio,
                taskId: task.id,
                taskTitle: task.title,
                status: status,
                score: status === 'success' ? 5 : 2,
                inputWord: inputWord,
                logs: logs,
                completedAt: new Date().toISOString()
            };
            ResultController.saveResult(result);
        }
    }
  }, [status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (status === 'running') {
          e.preventDefault(); // Prevent scrolling
          handleTick();
        } else if (status === 'loading') {
          e.preventDefault();
          handleLoadStep();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simState.status, loadingIndex, inputWord]);

  return (
    <div className="container" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #444' }}>← Назад</button>
        <h3>Выполнение задания: {task.title}</h3>
      </div>

      <div style={{ textAlign: 'left', background: '#333', padding: '1rem', borderRadius: '4px' }}>
        <p><strong>Шаблон:</strong> {task.template}</p>
        <p><strong>Описание:</strong> {task.description}</p>
        <div style={{ fontSize: '0.9rem', color: '#ccc' }}>
            {task.variables.map((v, i) => (
                <span key={i} style={{ marginRight: '1rem' }}>{v.symbol} = [{v.allowedValues}]</span>
            ))}
        </div>
      </div>

      {status === 'idle' && (
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Введите слово для проверки:</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              value={inputWord} 
              onChange={(e) => setInputWord(e.target.value)} 
              placeholder="Например: ул. Ленина, д. 10"
              style={{ flex: 1 }}
            />
            <button onClick={handleStart}>Начать проверку</button>
          </div>
        </div>
      )}

      {(status !== 'idle') && (
        <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', height: '70vh' }}>
          {/* Visualization Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Template Visualization */}
            <div style={{ border: '1px solid #444', padding: '1rem', borderRadius: '4px' }}>
              <h4>Шаблон</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {task.template.split('').map((char, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      width: '30px', height: '30px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #666',
                      backgroundColor: idx === templateIndex ? '#1e88e5' : (idx < templateIndex ? '#2e7d32' : 'transparent'),
                      color: 'white',
                      whiteSpace: 'pre'
                    }}
                  >
                    {char === ' ' ? '␣' : char}
                  </div>
                ))}
              </div>
            </div>

            {/* Stack Visualization */}
            <div style={{ height: '300px', border: '1px solid #444', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
              <h4>Магазин (Stack)</h4>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', overflowY: 'auto' }}>
                {stack.map((char, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      width: '80%', height: '24px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #666',
                      backgroundColor: idx === 0 ? '#1e88e5' : '#444', // Highlight top of stack (index 0)
                      borderRadius: '4px',
                      whiteSpace: 'pre'
                    }}
                  >
                    {char === ' ' ? '␣' : char}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Logs Area */}
          <div style={{ flex: 1, border: '1px solid #444', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
            <h4>Журнал</h4>
            <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'left' }}>
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #333' }}>{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
            {status === 'loading' && (
                <div style={{ marginTop: '1rem', color: '#ff9800', fontWeight: 'bold' }}>
                    Нажмите ПРОБЕЛ для загрузки символа
                </div>
            )}
            {status === 'running' && (
                <div style={{ marginTop: '1rem', color: '#646cff', fontWeight: 'bold' }}>
                    Нажмите ПРОБЕЛ для следующего такта
                </div>
            )}
            {status === 'success' && (
                <div style={{ marginTop: '1rem', color: '#4caf50', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    ЗАДАНИЕ ВЫПОЛНЕНО!
                </div>
            )}
            {status === 'error' && (
                <div style={{ marginTop: '1rem', color: '#f44336', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {errorMessage}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTaskView;
