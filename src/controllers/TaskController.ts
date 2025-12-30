import type { Task } from '../models/types';

const STORAGE_KEY = 'tasks';

export class TaskController {
  static getTasks(): Task[] {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    if (!savedTasks) return [];
    try {
      const parsed = JSON.parse(savedTasks);
      return parsed.map((t: any) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined
      }));
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [];
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
