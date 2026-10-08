import type { Task } from '../models/types';
import type { StoragePort } from '../models/StoragePort';
import type { FileDownloadPort } from '../models/FileDownloadPort';
import bundledTasks from '../data/default-tasks.json';

export class TaskController {
  /** Read assignments; initialize bundled defaults only when storage has no tasks key. */
  static getTasks(storage?: StoragePort, initialTasks: readonly Task[] = bundledTasks): Task[] {
    try {
      const store = storage ?? localStorage;
      const saved = store.getItem('tasks');
      const parsed: unknown = saved === null ? initialTasks : JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const tasks = parsed.filter((item): item is Task =>
        item !== null && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.title === 'string' && typeof item.description === 'string'
      ).map(({ id, title, description }) => ({ id, title, description }));
      if (saved === null) store.setItem('tasks', JSON.stringify(tasks));
      return tasks;
    } catch {
      return [];
    }
  }

  /** Export assignments for bundling without student results or local preferences. */
  static exportTasks(download: FileDownloadPort, storage?: StoragePort): void {
    download.saveFile('default-tasks.json', JSON.stringify(this.getTasks(storage), null, 2) + '\n', 'application/json');
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
