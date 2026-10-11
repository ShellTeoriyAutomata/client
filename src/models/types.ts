export interface Student {
    id: string;
    fio: string;
    group: string;
    password?: string;
}

export interface Teacher {
    login: string;
    password?: string;
}

export interface Group {
    id: string;
    name: string;
    students: Student[];
}

export interface TaskVariable {
    /** One explicitly declared uppercase English nonterminal. */
    symbol: string;
    /** Terminal set, optionally enclosed in braces. */
    allowedValues: string;
    description?: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
}

/** Student grammar with explicitly declared nonterminals. */
export interface GrammarDefinition {
    variables: TaskVariable[];
    /** Literal symbols of the template; named terminal sets are retained in variables. */
    terminals: string[];
    template: string;
    /** Explicit user alphabets; absent in older attempts. */
    alphabet?: AlphabetDefinition;
}

export interface AlphabetDefinition {
    terminals: string;
    nonterminals: string;
}

export type InputErrorKind = 'invalid_nonterminal' | 'invalid_terminal' | 'unknown_nonterminal' |
    'duplicate_nonterminal' | 'reserved_nonterminal' | 'invalid_set' | 'cyclic_reference' |
    'outside_alphabet' | 'empty_field';

export interface InputError {
    kind: InputErrorKind;
    field: string;
    message: string;
}

export interface ScoredInputError extends InputError {
    penalty: number;
}

export interface ScoringPolicy {
    penalties: Record<InputErrorKind, number>;
}

export interface Result {
    id: string;
    studentId: string;
    studentName: string; // Denormalized for easier display
    studentGroup?: string;
    taskId: string;
    taskTitle: string; // Denormalized
    taskDescription?: string;
    solution?: GrammarDefinition;
    status: 'success' | 'error';
    score: number;
    inputWord: string;
    logs: string[];
    /** Input history; older attempts may also contain matching errors. */
    errors?: string[];
    inputErrors?: ScoredInputError[];
    penaltyTotal?: number;
    maxScore?: number;
    passed?: boolean;
    comparisonMessage?: string;
    /** False when input penalties ended the attempt before stack loading. */
    comparisonPerformed?: boolean;
    completedAt: string; // ISO string
}
