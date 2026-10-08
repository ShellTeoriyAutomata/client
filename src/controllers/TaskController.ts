import type { Task } from '../models/types';
import type { StoragePort } from '../models/StoragePort';

export class TaskController {
  /** Read assignments, including older records whose grammar belonged to the teacher. */
  static getTasks(storage?: StoragePort): Task[] {
    try {
      const parsed: unknown = JSON.parse((storage ?? localStorage).getItem('tasks') ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is Task =>
        item !== null && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.title === 'string' && typeof item.description === 'string'
      ).map(({ id, title, description }) => ({ id, title, description }));
    } catch {
      return [];
    }
  }

  /** Save the title and description; grammar is supplied separately by each student. */
  static saveTask(task: Task, storage: StoragePort = localStorage): Task[] {
    const updated = [...this.getTasks(storage), { id: task.id, title: task.title, description: task.description }];
    storage.setItem('tasks', JSON.stringify(updated));
    return updated;
  }

  /** Remove an assignment while leaving submitted attempt snapshots intact. */
  static deleteTask(taskId: string, storage: StoragePort = localStorage): Task[] {
    const updated = this.getTasks(storage).filter(task => task.id !== taskId);
    storage.setItem('tasks', JSON.stringify(updated));
    return updated;
  }
}
