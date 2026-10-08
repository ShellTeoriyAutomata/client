import { useEffect, useRef, type KeyboardEvent } from 'react';

interface FailureDialogProps {
  saved: boolean;
  score: number;
  maxScore: number;
  error?: string;
  onRetry?: () => void;
  onBack: () => void;
}

/** End an input attempt immediately when its grade drops below fifty and show the final score. */
export default function FailureDialog({ saved, score, maxScore, error, onRetry, onBack }: FailureDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? dialog)?.focus();
  }, [saved, error]);

  function keepFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const target = event.shiftKey ? buttons[buttons.length - 1] : buttons[0];
    if (buttons.length <= 1 || event.target === (event.shiftKey ? buttons[0] : buttons[buttons.length - 1])) {
      event.preventDefault();
      target?.focus();
    }
  }

  return <div className="failure-overlay">
    <section ref={dialogRef} tabIndex={-1} className="failure-dialog" role="alertdialog" aria-modal="true" aria-labelledby="failure-heading" onKeyDown={keepFocus}>
      <h2 id="failure-heading">Вы не справились с работой</h2>
      <p>Ваш балл: <strong>{score} / {maxScore}</strong></p>
      {saved && <p>Результат сохранён и доступен преподавателю.</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {onRetry && <button type="button" onClick={onRetry}>Повторить сохранение результата</button>}
      <button type="button" onClick={onBack} disabled={!saved}>К заданиям</button>
    </section>
  </div>;
}
