interface CompletionPanelProps {
  saved: boolean;
  passed: boolean;
  canEdit: boolean;
  onEdit: () => void;
}

/** Present the completed report and return to the retained solution after saving the attempt. */
export default function CompletionPanel({ saved, passed, canEdit, onEdit }: CompletionPanelProps) {
  return (
    <section className="completion-panel" aria-label="Завершение попытки">
      <p className={passed ? 'success-text' : 'error-text'} role="status">{passed ? 'Вы справились с работой' : 'Вы не справились с работой'}</p>
      {saved && <p className="success-text" role="status">Результат сохранён и доступен преподавателю.</p>}
      {!canEdit && <p className="muted">Сначала сохраните результат кнопкой «Повторить сохранение результата».</p>}
      <button type="button" className="secondary-button" onClick={onEdit} disabled={!canEdit}>Вернуться к редактированию</button>
    </section>
  );
}
