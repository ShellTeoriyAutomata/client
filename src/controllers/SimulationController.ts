import type { Task } from '../models/types';

export type SimulationStatus = 'idle' | 'loading' | 'running' | 'success' | 'error';

export interface SimulationState {
  stack: string[];
  templateIndex: number;
  status: SimulationStatus;
  logs: string[];
  errorMessage: string;
  inputRemaining: string; // For display in logs
  currentStateIndex: number; // q0, q1, q2...
}

export class SimulationController {
  private task: Task;
  private state: SimulationState;

  constructor(task: Task) {
    this.task = task;
    this.state = {
      stack: ['Z0'],
      templateIndex: 0,
      status: 'idle',
      logs: [],
      errorMessage: '',
      inputRemaining: '',
      currentStateIndex: 0
    };
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public start(inputWord: string): void {
    this.state = {
      stack: ['Z0'],
      templateIndex: 0,
      status: 'loading',
      logs: [],
      errorMessage: '',
      inputRemaining: inputWord,
      currentStateIndex: 0
    };
    // Initial state log is not needed as per user request example, 
    // but we can keep a simple start message or just wait for the first loadChar
  }

  public loadChar(char: string, remainingAfter: string) {
    // Loading phase: q0 -> q1 -> q1 ...
    // Actually user example shows:
    // (q0,e,Z0) -> (q1,e,y)  -- First char load? No, wait.
    // The user example:
    // (q0,e,Z0) -> (q1,e,y)
    // (q1,e,y) -> (q1,e,y)
    // It seems q0 is initial, then it goes to q1 and stays in q1 while loading.
    
    const oldState = this.state.currentStateIndex === 0 ? 'q0' : 'q1';
    const newState = 'q1';
    
    // Left-sided stack: add to the beginning (top)
    // But wait, the user example: (q1,e,y) -> (q1,e,x)
    // It shows the stack TOP changing.
    
    const charDisplay = char === ' ' ? ' ' : char;
    const oldTop = this.state.stack[0] === 'Z0' ? 'Z0' : this.state.stack[0];
    
    this.state.stack = [char, ...this.state.stack];
    this.state.inputRemaining = remainingAfter;
    this.state.currentStateIndex = 1;
    
    const newTop = charDisplay;
    
    // Format: (q_old, e, old_top) -> (q_new, e, new_top)
    // Note: The user example has 'e' (epsilon) in the input position for loading?
    // (q0,e,Z0) -> (q1,e,y)
    // This implies input is consumed or ignored during loading in this notation?
    // Let's follow the user's format exactly.
    
    this.addLog(`(${oldState},e,${oldTop}) -> (${newState},e,${newTop})`);
  }

  public setStack(stack: string[]) {
    this.state.stack = stack;
  }

  public setStatus(status: SimulationStatus) {
    this.state.status = status;
  }

  public addLog(message: string) {
    this.state.logs = [...this.state.logs, message];
  }

  public tick(): SimulationState {
    if (this.state.status !== 'running') return this.state;

    const { stack, templateIndex, currentStateIndex } = this.state;
    const currentStack = [...stack];
    const char = currentStack.shift(); // First element is top (left-sided stack)

    // Check if we hit Z0
    if (char === 'Z0') {
        if (templateIndex >= this.task.template.length) {
            this.state.status = 'success';
            // Final transition to qf
            this.addLog(`(q${currentStateIndex},e,Z0) -> (qf,e,Z0)`);
            return this.state;
        } else {
            this.state.status = 'error';
            this.state.errorMessage = 'Ошибка: Магазин пуст (Z0), но шаблон не закончен.';
            this.addLog(this.state.errorMessage);
            return this.state;
        }
    }

    // Error: Template finished but stack remains (and it's not Z0)
    if (templateIndex >= this.task.template.length) {
      this.state.status = 'error';
      this.state.errorMessage = 'Ошибка: Шаблон закончен, но в магазине остались символы.';
      this.addLog(this.state.errorMessage);
      return this.state;
    }

    const tplChar = this.task.template[templateIndex];
    const charDisplay = char === ' ' ? ' ' : char;
    const tplCharDisplay = tplChar === ' ' ? ' ' : tplChar;

    let isMatch = false;
    const variable = this.task.variables.find(v => v.symbol === tplChar);

    if (variable) {
      try {
        let regex;
        if (variable.allowedValues.includes(',')) {
          // It's a comma-separated list: л,е,п,с -> (л|е|п|с)
          const allowedChars = variable.allowedValues.split(',').map(c => c.trim());
          regex = new RegExp(`^(${allowedChars.join('|')})$`, 'i');
        } else {
          // It's a range or character class: а-я, 0-9 -> [а-я], [0-9]
          regex = new RegExp(`^[${variable.allowedValues}]$`, 'i');
        }
        
        if (char && regex.test(char)) {
          isMatch = true;
        }
      } catch (e) {
        this.addLog(`Ошибка regex: ${e}`);
      }
    } else {
      if (char === tplChar) {
        isMatch = true;
      }
    }

    const oldState = `q${currentStateIndex}`;
    const newState = `q${currentStateIndex + 1}`;

    if (isMatch) {
      this.state.stack = currentStack;
      this.state.templateIndex = templateIndex + 1;
      this.state.currentStateIndex = currentStateIndex + 1;
      
      // Prepare next chars for display
      const nextStackChar = this.state.stack.length > 0 ? this.state.stack[0] : 'ε';
      const nextStackCharDisplay = nextStackChar === ' ' ? ' ' : nextStackChar;
      
      const nextTplIndex = templateIndex + 1;
      const nextTplChar = nextTplIndex < this.task.template.length ? this.task.template[nextTplIndex] : 'ε';
      const nextTplCharDisplay = nextTplChar === ' ' ? ' ' : nextTplChar;

      // Format: (q_old, stack_char, template_char) -> (q_new, next_stack_char, next_template_char)
      this.addLog(`(${oldState},${charDisplay},${tplCharDisplay}) -> (${newState},${nextStackCharDisplay},${nextTplCharDisplay})`);

      // Check for immediate success if Z0 is next
      if (this.state.stack.length === 1 && this.state.stack[0] === 'Z0' && this.state.templateIndex >= this.task.template.length) {
        this.state.status = 'success';
        this.addLog(`(${newState},e,Z0) -> (qf,e,Z0)`);
      }
    } else {
      this.state.status = 'error';
      this.state.errorMessage = `Ошибка: Символ '${charDisplay}' не соответствует ожидаемому '${tplCharDisplay}'`;
      this.addLog(`(${oldState},${charDisplay},${tplCharDisplay}) - Ошибка несоответствия`);
    }

    return this.state;
  }
}
