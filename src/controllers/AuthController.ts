import type { Student, Teacher } from '../models/types';

export class AuthController {
  static registerStudent(studentData: Omit<Student, 'id'>): boolean {
    // In a real app, this would make an API call
    console.log('Registering student:', studentData);
    // Simulate success
    return true;
  }

  static loginTeacher(credentials: Teacher): boolean {
    // In a real app, this would make an API call
    // For now, simple check
    return credentials.login === 'Преподаватель';
  }
}
