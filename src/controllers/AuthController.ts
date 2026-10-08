import type { Student, Teacher } from '../models/types';
import type { StoragePort } from '../models/StoragePort';

export class AuthController {
  /** Open a local student session with normalized name and group. */
  static registerStudent(studentData: Omit<Student, 'id'>, storage: StoragePort = localStorage): boolean {
    const fio = studentData.fio.trim();
    const group = studentData.group.trim();
    if (!fio || !group) return false;
    const student: Student = { id: Date.now().toString(), ...studentData, fio, group };
    storage.setItem('current_student', JSON.stringify(student));
    return true;
  }

  /** Read a valid student session or return null for missing/corrupt storage. */
  static getCurrentStudent(storage?: StoragePort): Student | null {
    try {
      const parsed: unknown = JSON.parse((storage ?? localStorage).getItem('current_student') ?? 'null');
      if (parsed === null || typeof parsed !== 'object') return null;
      const student = parsed as Partial<Student>;
      return typeof student.id === 'string' && typeof student.fio === 'string' && typeof student.group === 'string' ? student as Student : null;
    } catch {
      return null;
    }
  }

  /** End the current local student session. */
  static logout(storage: StoragePort = localStorage): void {
    storage.removeItem('current_student');
  }

  /** Validate the existing local teacher login. */
  static loginTeacher(credentials: Teacher): boolean {
    return credentials.login === 'Преподаватель';
  }
}
