import type { Student, Teacher } from '../models/types';

const SESSION_KEY = 'current_student';

export class AuthController {
  static registerStudent(studentData: Omit<Student, 'id'>): boolean {
    // In a real app, this would make an API call
    console.log('Registering student:', studentData);
    
    const newStudent: Student = {
        id: Date.now().toString(),
        ...studentData
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(newStudent));
    return true;
  }

  static getCurrentStudent(): Student | null {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      return JSON.parse(saved);
  }

  static logout(): void {
      localStorage.removeItem(SESSION_KEY);
  }

  static loginTeacher(credentials: Teacher): boolean {
    // In a real app, this would make an API call
    // For now, simple check
    return credentials.login === 'Преподаватель';
  }
}
