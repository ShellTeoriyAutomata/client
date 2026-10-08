import { useState } from 'react';
import { ResultController } from '../../controllers/ResultController';
import { TaskController } from '../../controllers/TaskController';
import ResultDetails from '../ResultDetails';
import ScoringSettings from '../ScoringSettings';
import type { Result } from '../../models/types';

interface ResultsTabProps {
  initialTaskId?: string;
}

/** Review student attempts, filter by group/assignment and inspect complete solution snapshots. */
export default function ResultsTab({ initialTaskId = '' }: ResultsTabProps) {
  const [results, setResults] = useState(() => ResultController.getResults());
  const [tasks, setTasks] = useState(() => TaskController.getTasks());
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [taskFilter, setTaskFilter] = useState(initialTaskId);
  const [error, setError] = useState('');
  const groups = [...new Set(results.map(result => result.studentGroup?.trim() || 'Группа не указана'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const assignmentOptions = new Map(tasks.map(task => [task.id, task.title]));
  results.forEach(result => { if (!assignmentOptions.has(result.taskId)) assignmentOptions.set(result.taskId, result.taskTitle); });
  const filtered = ResultController.filterResults(results, taskFilter, groupFilter);
  const filteredTask = tasks.find(task => task.id === taskFilter);

  function refresh() {
    setResults(ResultController.getResults());
    setTasks(TaskController.getTasks());
  }

  function clear() {
    if (!confirm('Очистить все результаты, включая скрытые фильтром?')) return;
    try {
      ResultController.clearResults();
      refresh();
      setError('');
    } catch {
      setError('Не удалось очистить результаты.');
    }
  }

  if (selectedResult) {
    return <ResultDetails result={selectedResult} assignment={tasks.find(task => task.id === selectedResult.taskId)} onBack={() => setSelectedResult(null)} />;
  }

  return (
    <section>
      <div className="screen-heading"><h3>Результаты учеников</h3><div className="actions"><button className="secondary-button" onClick={refresh}>Обновить</button><button className="secondary-button" onClick={clear}>Очистить</button></div></div>
      <ScoringSettings />
      <div className="result-filters">
        <div className="form-group"><label htmlFor="results-group">Группа</label><select id="results-group" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">Все группы</option>{groups.map(group => <option key={group} value={group}>{group}</option>)}</select></div>
        <div className="form-group"><label htmlFor="results-task">Задание</label><select id="results-task" value={taskFilter} onChange={event => setTaskFilter(event.target.value)}><option value="">Все задания</option>{[...assignmentOptions].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></div>
      </div>
      {filteredTask && <div className="assignment-summary"><strong>{filteredTask.title}</strong><p className="description">{filteredTask.description}</p></div>}
      <p className="muted">Попыток: {filtered.length} из {results.length}</p>
      {error && <p role="alert" className="error-text">{error}</p>}
      {filtered.length === 0 ? <p className="muted">Результатов по выбранным фильтрам пока нет.</p> : filtered.map(result => (
        <button key={result.id} className="list-item result-row" onClick={() => setSelectedResult(result)}>
          <span><strong>{result.studentName}</strong><span className="result-subtitle">{result.studentGroup || 'Группа не указана'} · {result.taskTitle}</span></span>
          <span className="result-meta">
            {result.maxScore === 100 && <span className={result.passed ? 'success-text' : 'error-text'}>{result.score} / 100 · {result.passed ? 'Справился' : 'Не справился'}</span>}
            <span>{result.comparisonPerformed === false ? 'Сопоставление не выполнялось' : result.status === 'success' ? 'Соответствует шаблону' : 'Не соответствует шаблону'}</span>
            <small className="muted">Ошибок ввода: {result.inputErrors?.length ?? result.errors?.length ?? 0}</small>
            <small className="muted">{new Date(result.completedAt).toLocaleString('ru-RU')}</small>
          </span>
        </button>
      ))}
    </section>
  );
}
