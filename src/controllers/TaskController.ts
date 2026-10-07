import type { Task } from '../models/types';

const STORAGE_KEY = 'tasks';

export class TaskController {
  static getTasks(): Task[] {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    const grammarTask: Task = {
      id: 'grammar-test-task',
      title: 'Лабораторная: грамматика адреса',
      description: 'Задайте грамматику и проверьте таблицу: улица — 5–10 букв, дом — 3 цифры, квартира — 2 цифры. _ означает epsilon.',
      deadline: new Date('2026-12-31'),
      type: 'grammar-validation',
      grammarMode: 'address',
      variables: [],
      template: ''
    };
    
    if (!savedTasks) return [grammarTask];
    try {
      const parsed = JSON.parse(savedTasks);
      const tasks = parsed.map((t: any) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined
      }));
      // Ensure we don't add duplicates if it was somehow saved (though we are hardcoding it now)
      // Actually, let's just prepend it for now so it is always visible.
      // Filter out if it was saved to avoid duplication if we decide to save it later.
      return [grammarTask, ...tasks.filter((t: Task) => t.id !== 'grammar-test-task')];
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [grammarTask];
    }
  }

  static saveTask(task: Task): Task[] {
    const tasks = this.getTasks();
    const updatedTasks = [...tasks, task];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    return updatedTasks;
  }

  static deleteTask(taskId: string): Task[] {
    const tasks = this.getTasks();
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    return updatedTasks;
  }
}
