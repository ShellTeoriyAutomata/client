import type { InputError } from '../models/types';

export interface TimerPort {
  schedule(callback: () => void, milliseconds: number): unknown;
  cancel(handle: unknown): void;
}

export interface InputGuardActions {
  record(errors: InputError[]): void;
  clear(): void;
  setFrozen(frozen: boolean): void;
}

/** Record an invalid input once, freeze editing for one second, then remove the rejected fragment. */
export class InputGuardController {
  private pending: unknown;
  private frozen = false;

  /** Remove the last invalid word or set member while preserving existing words and ranges. */
  static removeLastWord(value: string, accepts?: (candidate: string) => boolean): string {
    if (accepts) {
      const words = Array.from(value.matchAll(/[^{};,\s]+/gu));
      for (const word of words.reverse()) {
        const candidate = value.slice(0, word.index) + value.slice(word.index + word[0].length);
        if (candidate.replace(/[{};,\s]/gu, '') && accepts(candidate)) return candidate;
      }
      // A joined set can contain good ranges followed by one invalid symbol.
      const members = Array.from(value.matchAll(/\\[\s\S]|[^{};,\s\\]-[^{};,\s\\]|[^{};,\s]/gu));
      for (const member of members.reverse()) {
        const candidate = value.slice(0, member.index) + value.slice(member.index + member[0].length);
        if (accepts(candidate)) return candidate;
      }
    }
    return value.replace(/[^{};,\s]+(?=[{};,\s]*$)/u, '');
  }

  /** Use an injected scheduler so cleanup and the exact freeze duration can be tested. */
  constructor(private readonly timer: TimerPort) {}

  /** Reject a field edit unless another rejected edit is already waiting to be cleared. */
  public reject(errors: InputError[], actions: InputGuardActions): boolean {
    if (this.frozen || errors.length === 0) return false;
    this.frozen = true;
    actions.record(errors.map(error => ({ ...error })));
    actions.setFrozen(true);
    this.pending = this.timer.schedule(() => {
      this.pending = undefined;
      actions.clear();
      this.frozen = false;
      actions.setFrozen(false);
    }, 1000);
    return true;
  }

  /** Cancel delayed edits when the editor is removed. */
  public dispose(): void {
    if (this.pending !== undefined) this.timer.cancel(this.pending);
    this.pending = undefined;
    this.frozen = false;
  }
}
