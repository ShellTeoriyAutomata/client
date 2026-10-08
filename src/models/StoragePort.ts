/** Persistent storage dependency shared by controllers and their test adapters. */
export interface StoragePort {
  /** Read a persisted value, returning null when its key is absent. */
  getItem(key: string): string | null;
  /** Write a serialized value to persistent storage. */
  setItem(key: string, value: string): void;
  /** Remove a persisted value. */
  removeItem(key: string): void;
}
