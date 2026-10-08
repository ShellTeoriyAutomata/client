import type { Result, Student, Task, GrammarDefinition, InputError, ScoringPolicy } from '../models/types';
import type { StoragePort } from '../models/StoragePort';
import type { SimulationState } from './SimulationController';
import { ScoringController } from './ScoringController';

export interface ResultSubmission {
  id: string;
  student: Student;
  task: Task;
  solution: GrammarDefinition;
  state: SimulationState;
  completedAt: string;
  inputErrors?: InputError[];
  scoringPolicy?: ScoringPolicy;
}

export interface InputFailureSubmission extends Omit<ResultSubmission, 'state'> {
  inputWord: string;
}

export class ResultController {
  /** Save a failed input attempt without claiming that a comparison was performed. */
  static createInputFailure(submission: InputFailureSubmission): Result {
    const grade = ScoringController.grade(submission.inputErrors ?? [], submission.scoringPolicy ?? ScoringController.getPolicy());
    if (grade.passed) throw new Error('The input attempt has not failed');
    return this.snapshot(submission, submission.inputWord, 'error', [], '', false);
  }
  /** Build an independent result snapshot after the laboratory finishes. */
  static createResult({ id, student, task, solution, state, completedAt, inputErrors = [], scoringPolicy }: ResultSubmission): Result {
    if (state.status !== 'success' && state.status !== 'error') throw new Error('The attempt is not complete');
    return this.snapshot({ id, student, task, solution, completedAt, inputErrors, scoringPolicy }, state.inputWord, state.status, state.logs, state.errorMessage, true);
  }

  private static snapshot({ id, student, task, solution, completedAt, inputErrors = [], scoringPolicy }: Omit<ResultSubmission, 'state'>, inputWord: string, status: Result['status'], logs: string[], comparisonMessage: string, comparisonPerformed: boolean): Result {
    const grade = ScoringController.grade(inputErrors, scoringPolicy ?? ScoringController.getPolicy());
    return {
      id, studentId: student.id, studentName: student.fio, studentGroup: student.group.trim(),
      taskId: task.id, taskTitle: task.title, taskDescription: task.description,
      solution: { ...solution, ...(solution.alphabet ? { alphabet: { ...solution.alphabet } } : {}), terminals: [...solution.terminals], variables: solution.variables.map(variable => ({ ...variable })) },
      status, ...grade, inputWord, logs: [...logs], errors: grade.inputErrors.map(error => error.message), comparisonMessage, comparisonPerformed, completedAt,
    };
  }

  /** Read submitted attempts, including older records without grammar or group snapshots. */
  static getResults(storage?: StoragePort): Result[] {
    try {
      const parsed: unknown = JSON.parse((storage ?? localStorage).getItem('results') ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((item): item is Result =>
        item !== null && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.studentId === 'string' && typeof item.studentName === 'string' &&
        typeof item.taskId === 'string' && typeof item.taskTitle === 'string' &&
        (item.status === 'success' || item.status === 'error') &&
        typeof item.inputWord === 'string' && typeof item.completedAt === 'string' &&
        Array.isArray(item.logs) && item.logs.every((log: unknown) => typeof log === 'string') &&
        (item.errors === undefined || (Array.isArray(item.errors) && item.errors.every((error: unknown) => typeof error === 'string'))) &&
        (item.comparisonPerformed === undefined || typeof item.comparisonPerformed === 'boolean') &&
        this.validGrade(item)
      ) : [];
    } catch {
      return [];
    }
  }

  /** Save an attempt once, preserving the assignment and student's configuration. */
  static saveResult(result: Result, storage: StoragePort = localStorage): void {
    const results = this.getResults(storage);
    if (results.some(item => item.id === result.id)) return;
    storage.setItem('results', JSON.stringify([result, ...results]));
  }

  /** Return one student's submitted attempts. */
  static getResultsByStudent(studentId: string, storage: StoragePort = localStorage): Result[] {
    return this.getResults(storage).filter(result => result.studentId === studentId);
  }

  /** Apply group and assignment filters together; legacy attempts have a separate group label. */
  static filterResults(results: Result[], taskId: string, group: string): Result[] {
    return results.filter(result => (!taskId || result.taskId === taskId) &&
      (!group || (result.studentGroup?.trim() || 'Группа не указана') === group));
  }

  /** Delete saved results after confirmation in the user interface. */
  static clearResults(storage: StoragePort = localStorage): void {
    storage.removeItem('results');
  }

  private static validGrade(item: Record<string, unknown>): boolean {
    if (item.inputErrors === undefined) return item.maxScore === undefined;
    if (!Array.isArray(item.inputErrors)) return false;
    let total = 0;
    for (const error of item.inputErrors) {
      if (!error || typeof error !== 'object' || typeof error.field !== 'string' || typeof error.message !== 'string' ||
          !ScoringController.categories().some(category => category.kind === error.kind) ||
          !Number.isInteger(error.penalty) || error.penalty < 0 || error.penalty > 100) return false;
      total += error.penalty;
    }
    const score = Math.max(0, 100 - total);
    return item.maxScore === 100 && item.penaltyTotal === total && item.score === score && item.passed === (score >= 50);
  }
}
