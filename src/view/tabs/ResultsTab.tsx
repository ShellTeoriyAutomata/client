import React, { useState, useEffect } from 'react';
import { ResultController } from '../../controllers/ResultController';
import type { Result } from '../../models/types';

const ResultsTab: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = () => {
    setResults(ResultController.getResults());
  };

  const handleClear = () => {
      if (confirm('Вы уверены, что хотите очистить все результаты?')) {
          ResultController.clearResults();
          loadResults();
      }
  };

  if (selectedResult) {
    return (
      <div>
        <button onClick={() => setSelectedResult(null)} style={{ marginBottom: '1rem', background: 'none', border: '1px solid #444' }}>← Назад к списку</button>
        <h3>Детали выполнения</h3>
        <div style={{ background: '#333', padding: '1rem', borderRadius: '4px', textAlign: 'left' }}>
            <p><strong>Студент:</strong> {selectedResult.studentName}</p>
            <p><strong>Задание:</strong> {selectedResult.taskTitle}</p>
            <p><strong>Дата:</strong> {new Date(selectedResult.completedAt).toLocaleString()}</p>
            <p><strong>Входное слово:</strong> "{selectedResult.inputWord}"</p>
            <p><strong>Статус:</strong> <span style={{ color: selectedResult.status === 'success' ? '#4caf50' : '#f44336' }}>{selectedResult.status === 'success' ? 'Успех' : 'Ошибка'}</span></p>
            
            <h4>Журнал выполнения:</h4>
            <div style={{ maxHeight: '400px', overflowY: 'auto', background: '#222', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {selectedResult.logs.map((log, i) => {
                    if (typeof log === 'string') {
                        return <div key={i} style={{ borderBottom: '1px solid #444', padding: '2px 0' }}>{log}</div>;
                    } else {
                        return (
                            <details key={i} open style={{ margin: '0.5rem 0', border: '1px solid #555', borderRadius: '4px', padding: '0.5rem' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: log.isError ? '#ff8a80' : '#81c784' }}>
                                    {log.title}
                                </summary>
                                <div style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                                    {log.items.map((item, j) => (
                                        <div key={j} style={{ borderBottom: '1px solid #444', padding: '2px 0', color: log.isError ? '#ffa726' : '#eee' }}>
                                            {item}
                                        </div>
                                    ))}
                                    {log.items.length === 0 && <span style={{ color: '#888', fontStyle: 'italic' }}>Нет записей</span>}
                                </div>
                            </details>
                        );
                    }
                })}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Результаты студентов</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={loadResults} style={{ fontSize: '0.8rem' }}>Обновить</button>
            <button onClick={handleClear} style={{ fontSize: '0.8rem', backgroundColor: '#d32f2f' }}>Очистить</button>
        </div>
      </div>
      {results.length === 0 ? (
        <p>Результатов пока нет</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map(result => (
                <div 
                    key={result.id} 
                    className="list-item" 
                    style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                    onClick={() => setSelectedResult(result)}
                >
                    <div style={{ textAlign: 'left' }}>
                        <div><strong>{result.studentName}</strong></div>
                        <div style={{ fontSize: '0.9rem', color: '#ccc' }}>{result.taskTitle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: result.status === 'success' ? '#4caf50' : '#f44336' }}>
                            {result.status === 'success' ? 'Сдано' : 'Ошибка'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>
                            {new Date(result.completedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default ResultsTab;
