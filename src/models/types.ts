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

export type TaskType = 'address' | 'phone' | 'email' | 'custom';

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
    variables: TaskVariable[];
    template: string;
}

export interface Result {
    id: string;
    studentId: string;
    studentName: string; // Denormalized for easier display
    taskId: string;
    taskTitle: string; // Denormalized
    status: 'success' | 'error';
    score: number;
    inputWord: string;
    logs: string[];
    completedAt: string; // ISO string
}
