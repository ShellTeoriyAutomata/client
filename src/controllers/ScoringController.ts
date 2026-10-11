import type { InputError, InputErrorKind, ScoredInputError, ScoringPolicy } from '../models/types';
import type { StoragePort } from '../models/StoragePort';

export interface Grade {
  score: number;
  maxScore: number;
  passed: boolean;
  penaltyTotal: number;
  inputErrors: ScoredInputError[];
}

/** Apply teacher-configured input penalties independently of the word matching outcome. */
export class ScoringController {
  /** Return all supported mistake categories and labels for the teacher. */
  static categories(): { kind: InputErrorKind; label: string }[] {
    return [
      { kind: 'invalid_nonterminal', label: 'Недопустимое обозначение нетерминала' },
      { kind: 'invalid_terminal', label: 'Недопустимая английская буква в терминалах' },
      { kind: 'unknown_nonterminal', label: 'Необъявленный нетерминал' },
      { kind: 'duplicate_nonterminal', label: 'Повторное объявление нетерминала' },
      { kind: 'reserved_nonterminal', label: 'Зарезервированное обозначение (старые попытки)' },
      { kind: 'invalid_set', label: 'Некорректное множество или диапазон' },
      { kind: 'cyclic_reference', label: 'Циклическая ссылка между множествами' },
      { kind: 'outside_alphabet', label: 'Символ вне заданного алфавита' },
      { kind: 'empty_field', label: 'Не заполнен алфавит или описание множества' },
    ];
  }

  /** Give each input mistake a five-point penalty by default. */
  static defaultPolicy(): ScoringPolicy {
    return { penalties: Object.fromEntries(this.categories().map(({ kind }) => [kind, 5])) as Record<InputErrorKind, number> };
  }

  /** Read the policy for future results, falling back safely if storage is unavailable. */
  static getPolicy(storage?: StoragePort): ScoringPolicy {
    try {
      const policy: unknown = JSON.parse((storage ?? localStorage).getItem('automata.scoring') ?? 'null');
      if (this.validPolicy(policy)) return policy;
    } catch { /* Use defaults for older or unavailable storage. */ }
    return this.defaultPolicy();
  }

  /** Save nonnegative integer penalties between zero and one hundred. */
  static savePolicy(policy: ScoringPolicy, storage: StoragePort = localStorage): void {
    if (!this.validPolicy(policy)) throw new Error('Штрафы должны быть целыми числами от 0 до 100.');
    storage.setItem('automata.scoring', JSON.stringify(policy));
  }

  /** Score only input mistakes; fifty points is a pass and scores cannot fall below zero. */
  static grade(errors: readonly InputError[], policy: ScoringPolicy = this.defaultPolicy()): Grade {
    if (!this.validPolicy(policy)) throw new Error('Некорректные штрафы.');
    const inputErrors = errors.map(error => ({ ...error, penalty: policy.penalties[error.kind] }));
    const penaltyTotal = inputErrors.reduce((sum, error) => sum + error.penalty, 0);
    const score = Math.max(0, 100 - penaltyTotal);
    return { score, maxScore: 100, passed: score >= 50, penaltyTotal, inputErrors };
  }

  private static validPolicy(policy: unknown): policy is ScoringPolicy {
    if (!policy || typeof policy !== 'object' || !('penalties' in policy) || !policy.penalties || typeof policy.penalties !== 'object') return false;
    const penalties = policy.penalties as Record<string, unknown>;
    return this.categories().every(({ kind }) => typeof penalties[kind] === 'number' &&
      Number.isInteger(penalties[kind]) && (penalties[kind] as number) >= 0 && (penalties[kind] as number) <= 100);
  }
}
