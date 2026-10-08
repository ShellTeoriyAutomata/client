import { useState, type FormEvent } from 'react';
import { ScoringController } from '../controllers/ScoringController';

/** Configure separate input penalties for future attempts, keeping saved grades unchanged. */
export default function ScoringSettings() {
  const [policy, setPolicy] = useState(() => ScoringController.getPolicy());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function save(event: FormEvent) {
    event.preventDefault();
    try {
      ScoringController.savePolicy(policy);
      setMessage('Штрафы сохранены для новых попыток.');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить штрафы.');
      setMessage('');
    }
  }

  return (
    <details className="scoring-settings assignment-summary">
      <summary>Ошибки и штрафы</summary>
      <p className="muted">Начальный балл — 100. Меньше 50 баллов — «Не справился». Штрафы применяются только к ошибкам ввода алфавитов, для новых попыток.</p>
      <form onSubmit={save}>
        <div className="penalty-grid">{ScoringController.categories().map(({ kind, label }) => (
          <div className="form-group" key={kind}><label htmlFor={`penalty-${kind}`}>{label}</label><div className="penalty-input"><span aria-hidden="true">−</span><input type="number" id={`penalty-${kind}`} min={0} max={100} step={1} required value={policy.penalties[kind]} onChange={event => { setPolicy({ penalties: { ...policy.penalties, [kind]: Number(event.target.value) } }); setMessage(''); }} /></div></div>
        ))}</div>
        <button type="submit">Сохранить штрафы</button>
        {message && <p className="success-text" role="status">{message}</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
      </form>
    </details>
  );
}
