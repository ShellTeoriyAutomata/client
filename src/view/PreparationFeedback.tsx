import type { PreparationFeedback as Feedback } from '../controllers/PreparationController';

/** Show a short notice while retaining detailed mistakes for the teacher. */
export default function PreparationFeedback({ errors }: Feedback) {
  if (errors.length === 0) return null;
  return <p className="preparation-feedback error-text" role="alert">Ошибка</p>;
}
