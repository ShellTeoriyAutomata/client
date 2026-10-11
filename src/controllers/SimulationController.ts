import type { GrammarDefinition } from '../models/types';
import { GrammarController } from './GrammarController';

export type SimulationStatus = 'idle' | 'loading' | 'running' | 'success' | 'error';

export interface SimulationState {
  stack: string[];
  templateIndex: number;
  inputIndex: number;
  loadingIndex: number;
  status: SimulationStatus;
  logs: string[];
  errorMessage: string;
  errors: string[];
  inputWord: string;
  inputRemaining: string;
  currentStateIndex: number;
}

export class SimulationController {
  private readonly grammar: GrammarDefinition;
  private state: SimulationState;

  /** Create an isolated attempt from the student's grammar. */
  constructor(grammar: GrammarDefinition) {
    this.grammar = GrammarController.createGrammar(grammar.variables, grammar.template, grammar.alphabet);
    this.state = this.initialState('', 'idle');
  }

  /** Return a snapshot safe for React and callers to retain or modify. */
  public getState(): SimulationState {
    return { ...this.state, stack: [...this.state.stack], logs: [...this.state.logs], errors: [...this.state.errors] };
  }

  /** Begin comparing the submitted word; input mistakes and grades belong to the preparation stage. */
  public start(inputWord: string): SimulationState {
    this.state = this.initialState(inputWord, 'loading');
    if (this.state.loadingIndex < 0) this.beginMatching();
    return this.getState();
  }

  /** Push the next template symbol; matching starts only after the whole template is loaded. */
  public loadNext(): SimulationState {
    if (this.state.status !== 'loading') return this.getState();
    const char = Array.from(this.grammar.template)[this.state.loadingIndex];
    const before = this.configuration(`q${this.state.currentStateIndex}`, 'ε');
    this.state.stack.unshift(char);
    this.state.loadingIndex -= 1;
    this.state.currentStateIndex = 1;
    this.state.logs.push(`${before} → ${this.configuration('q1', 'ε')}`);
    if (this.state.loadingIndex < 0) {
      this.beginMatching();
    }
    return this.getState();
  }

  /** Match the current input symbol with the template symbol at the top of the stack. */
  public tick(): SimulationState {
    if (this.state.status !== 'running') return this.getState();
    const word = Array.from(this.state.inputWord);
    const top = this.state.stack[0];
    const char = word[this.state.inputIndex];
    if (top === 'Z0') {
      if (char === undefined) this.succeed();
      else this.fail(`Шаблон закончился: лишний символ входного слова «${this.display(char)}» (позиция ${this.state.inputIndex + 1}), вершина стека — Z0.`);
      return this.getState();
    }
    if (char === undefined) {
      this.fail(`Входное слово закончилось: для символа стека «${this.display(top)}» нет входного символа (позиция ${this.state.templateIndex + 1}).`);
      return this.getState();
    }
    const variable = this.grammar.variables.find(item => item.symbol === top && /^[A-Z]$/.test(item.symbol));
    const matched = variable ? GrammarController.matches(char, variable.allowedValues, this.grammar.variables) : !/^[A-Z]$/.test(top) && char === top;
    if (!matched) {
      this.fail(`Символ слова «${this.display(char)}» не соответствует символу шаблона «${this.display(top)}» (позиция ${this.state.inputIndex + 1}).`);
      return this.getState();
    }
    const before = this.configuration(`q${this.state.currentStateIndex}`, this.display(char));
    this.state.stack.shift();
    this.state.inputIndex += 1;
    this.state.templateIndex += 1;
    this.state.inputRemaining = word.slice(this.state.inputIndex).join('');
    this.state.currentStateIndex += 1;
    this.state.logs.push(`${before} → ${this.configuration(`q${this.state.currentStateIndex}`, this.inputSymbol())}`);
    if (this.state.stack[0] === 'Z0' && this.state.inputIndex === word.length) this.succeed();
    return this.getState();
  }

  private initialState(inputWord: string, status: SimulationStatus): SimulationState {
    return { stack: ['Z0'], templateIndex: 0, inputIndex: 0,
      loadingIndex: Array.from(this.grammar.template).length - 1, status, logs: [], errorMessage: '', errors: [],
      inputWord, inputRemaining: inputWord, currentStateIndex: 0 };
  }

  private beginMatching(): void {
    const before = this.configuration(`q${this.state.currentStateIndex}`, 'ε');
    this.state.status = 'running';
    this.state.currentStateIndex = 2;
    this.state.logs.push('магазин заполнен');
    this.state.logs.push(`${before} → ${this.configuration('q2', this.inputSymbol())}`);
  }

  private fail(message?: string): void {
    const input = this.state.status === 'loading' ? 'ε' : this.inputSymbol();
    this.state.logs.push(`${this.configuration(`q${this.state.currentStateIndex}`, input)} → ${this.configuration('qerr', input)}`);
    this.state.status = 'error';
    this.state.errorMessage = message ?? '';
  }

  private succeed(): void {
    this.state.status = 'success';
    this.state.logs.push(`${this.configuration(`q${this.state.currentStateIndex}`, 'ε')} → ${this.configuration('qf', 'ε')}`);
  }

  private display(char: string): string {
    return char === ' ' ? '␣' : char;
  }

  private inputSymbol(): string {
    return this.display(Array.from(this.state.inputWord)[this.state.inputIndex] ?? 'ε');
  }

  private configuration(state: string, input: string): string {
    return `(${state}, ${input}, ${this.display(this.state.stack[0] ?? 'ε')})`;
  }
}
