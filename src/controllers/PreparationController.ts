import type { GrammarDefinition, InputError, ScoringPolicy } from '../models/types';
import { ScoringController, type Grade } from './ScoringController';
import { GrammarController } from './GrammarController';
import { SimulationController, type SimulationState } from './SimulationController';

export interface PreparationFeedback {
  errors: string[];
  errorCount: number;
}

export type PreparationResult =
  | (PreparationFeedback & { ready: false })
  | { ready: true; grammar: GrammarDefinition; controller: SimulationController; state: SimulationState; inputErrors: InputError[] };

/** Keep submission mistakes for one laboratory attempt while blocking invalid preparations. */
export class PreparationController {
  private history: InputError[] = [];
  private readonly policy: ScoringPolicy;

  /** Freeze the teacher's penalties for this entire attempt. */
  constructor(policy: ScoringPolicy = ScoringController.getPolicy()) {
    this.policy = { penalties: { ...policy.penalties } };
  }

  /** Return the current input grade without adding comparison penalties. */
  public getGrade(): Grade {
    return ScoringController.grade(this.history, this.policy);
  }

  /** Stop the attempt as soon as its score falls below fifty. */
  public hasFailed(): boolean {
    return !this.getGrade().passed;
  }

  /** Return an independent policy snapshot for the saved report. */
  public getPolicy(): ScoringPolicy {
    return { penalties: { ...this.policy.penalties } };
  }

  /** Record input-stage mistakes without exposing the history in the matching screen. */
  public record(errors: readonly InputError[]): void {
    if (this.hasFailed()) return;
    this.history.push(...errors.map(error => ({ ...error })));
  }

  /** Return an independent history for the teacher's submitted report. */
  public getInputErrors(): InputError[] {
    return this.history.map(error => ({ ...error }));
  }

  /** Collect all current errors, or start a simulation with the history of corrected mistakes. */
  public submit(grammar: GrammarDefinition, inputWord: string): PreparationResult {
    if (this.hasFailed()) return { ready: false, errors: [], errorCount: this.history.length };
    const issues = [...GrammarController.validateAlphabet(grammar), ...GrammarController.validateInputWord(inputWord, grammar)];
    if (issues.length > 0) {
      this.record(issues);
      return { ready: false, errors: issues.map(issue => issue.message), errorCount: this.history.length };
    }
    if (!grammar.template) return { ready: false, errors: ['Шаблон не заполнен.'], errorCount: this.history.length };
    const solution = GrammarController.createGrammar(grammar.variables, grammar.template, grammar.alphabet);
    const controller = new SimulationController(solution);
    return { ready: true, grammar: solution, controller, state: controller.start(inputWord), inputErrors: this.getInputErrors() };
  }
}
