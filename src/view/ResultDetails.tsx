import type { Result, Task } from '../models/types';
import LaboratoryErrors from './LaboratoryErrors';
import AssignmentDescription from './AssignmentDescription';

interface ResultDetailsProps {
  result: Result;
  assignment?: Task;
  onBack: () => void;
}

/** Review the saved condition, solution, transitions and final errors of one attempt. */
export default function ResultDetails({ result, assignment, onBack }: ResultDetailsProps) {
  return (
    <section>
      <button className="secondary-button" onClick={onBack}>← К результатам</button>
      <h3>{result.taskTitle}</h3>
      <AssignmentDescription description={result.taskDescription ?? assignment?.description ?? 'Описание не сохранено в этой старой попытке.'} solution={result.solution} />
      <dl className="result-details">
        <dt>Ученик</dt><dd>{result.studentName}</dd>
        <dt>Группа</dt><dd>{result.studentGroup || 'Группа не указана'}</dd>
        <dt>Дата</dt><dd>{new Date(result.completedAt).toLocaleString('ru-RU')}</dd>
        <dt>Шаблон</dt><dd className="literal">{result.solution ? result.solution.template || 'Пустой шаблон' : 'Не сохранён'}</dd>
        <dt>Входное слово</dt><dd className="literal">{result.inputWord || 'Пустое слово'}</dd>
        <dt>Сопоставление</dt><dd>{result.comparisonPerformed === false ? 'Сопоставление не выполнялось' : result.status === 'success' ? 'Соответствует шаблону' : 'Не соответствует шаблону'}</dd>
        {result.maxScore === 100 ? <>
          <dt>Баллы</dt><dd>{result.score} / 100</dd>
          <dt>Итог</dt><dd className={result.passed ? 'success-text' : 'error-text'}>{result.passed ? 'Справился' : 'Не справился'}</dd>
          <dt>Ошибок ввода</dt><dd>{result.inputErrors?.length ?? 0}</dd>
          <dt>Сумма штрафов</dt><dd>−{result.penaltyTotal ?? 0}</dd>
        </> : <><dt>Оценка старой попытки</dt><dd>{result.score ?? 'Не сохранена'}</dd></>}
      </dl>
      {result.comparisonMessage && <p className="description">Причина несоответствия: {result.comparisonMessage}</p>}
      {result.inputErrors ? <section className="input-errors-report">
        <h4>Ошибки ввода</h4>
        {result.inputErrors.length === 0 ? <p className="muted">Ошибки ввода не зафиксированы.</p> : <div className="table-scroll"><table><thead><tr><th>Ошибка</th><th>Штраф</th></tr></thead><tbody>{result.inputErrors.map((error, index) => <tr key={index}><td>{error.message}</td><td>−{error.penalty}</td></tr>)}</tbody></table></div>}
      </section> : <LaboratoryErrors errors={result.errors ?? (result.status === 'error' ? ['Причина ошибки не сохранена в старой попытке. См. журнал переходов.'] : [])} />}
      {result.solution ? (
        <section className="assignment-summary">
          <h4>Решение ученика</h4>
          <h4>Нетерминалы и терминальные множества</h4>
          {result.solution.variables.length === 0 ? <p className="muted">Нетерминалы не заданы.</p> :
            result.solution.variables.map((variable, index) => <p key={index}><code>{variable.symbol} = {variable.allowedValues}</code></p>)}
        </section>
      ) : <p className="muted">В старой попытке алфавит и шаблон ученика не сохранялись.</p>}
      <h4>Журнал выполнения</h4>
      <div className="simulation-logs result-logs">{result.logs.map((log, index) => <div key={index}>{log}</div>)}</div>
    </section>
  );
}
