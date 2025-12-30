import type { Group } from '../models/types';

export class GroupController {
  private static STORAGE_KEY = 'groups';

  static getGroups(): Group[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static saveGroup(group: Group): void {
    const groups = this.getGroups();
    groups.push(group);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
  }

  static deleteGroup(id: string): void {
    const groups = this.getGroups().filter(g => g.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
  }
}
