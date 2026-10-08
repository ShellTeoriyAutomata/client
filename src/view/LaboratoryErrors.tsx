interface LaboratoryErrorsProps {
  errors: string[];
}

/** Show an expandable final error report with the same count for the student and teacher. */
export default function LaboratoryErrors({ errors }: LaboratoryErrorsProps) {
  return (
    <details className={`laboratory-errors ${errors.length ? 'error-text' : ''}`} open={errors.length > 0}>
      <summary>Журнал ошибок ({errors.length})</summary>
      {errors.length > 0 ? <ul role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : <p className="success-text">Ошибок не обнаружено.</p>}
    </details>
  );
}
