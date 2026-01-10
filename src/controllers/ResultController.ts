import type { Result } from '../models/types';

const STORAGE_KEY = 'results';

export class ResultController {
  static getResults(): Result[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load results", e);
      return [];
    }
  }

  static saveResult(result: Result): void {
    const results = this.getResults();
    // Add new result to the beginning
    const updatedResults = [result, ...results];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedResults));
  }

  static getResultsByStudent(studentId: string): Result[] {
    return this.getResults().filter(r => r.studentId === studentId);
  }
  
  static clearResults(): void {
      localStorage.removeItem(STORAGE_KEY);
  }
}
