import type { StoragePort } from '../models/StoragePort';

export type Theme = 'light' | 'dark';

export class AppearanceController {
  /** Read the saved theme; unavailable storage uses the default dark theme. */
  static getTheme(storage?: Pick<StoragePort, 'getItem'>): Theme {
    try {
      return (storage ?? localStorage).getItem('automata.theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  /** Persist a theme when local storage is available. */
  static saveTheme(theme: Theme, storage?: Pick<StoragePort, 'setItem'>): void {
    try {
      (storage ?? localStorage).setItem('automata.theme', theme);
    } catch {
      // The current session still supports switching themes without persistence.
    }
  }
}
