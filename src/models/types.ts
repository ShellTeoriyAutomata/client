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

export type TaskType = 'address' | 'phone' | 'email' | 'custom' | 'grammar-validation';

export interface TaskVariable {
    symbol: string;
    allowedValues: string;
    description?: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    deadline?: Date;
    type: TaskType;
    /** Отмечает адресную лабораторную; количество и назначения нетерминалов не ограничивает. */
    grammarMode?: 'address';
    variables: TaskVariable[];
    template: string;
}


export interface LogSection {
    title: string;
    items: string[];
    isError?: boolean;
}

export interface Result {
    id: string;
    studentId: string;
    studentName: string; // Denormalized for easier display
    taskId: string;
    taskTitle: string; // Denormalized
    status: 'success' | 'error';
    score: number;
    /** Число ошибок студента в лабораторной; отсутствует у старых результатов. */
    mistakeCount?: number;
    /** Полная история ошибок студента при вводе и заполнении таблицы. */
    errorHistory?: string[];
    /** Соответствует ли проверочное слово грамматике; отдельно от правильности таблицы. */
    wordAccepted?: boolean;
    inputWord: string;
    logs: (string | LogSection)[];
    completedAt: string; // ISO string
}
