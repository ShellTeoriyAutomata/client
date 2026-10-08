import { useState } from 'react';
import './view/styles/main.css';
import StudentRegistration from './view/StudentRegistration';
import TeacherLogin from './view/TeacherLogin';
import TeacherDashboard from './view/TeacherDashboard';
import StudentDashboard from './view/StudentDashboard';
import { AppearanceController } from './controllers/AppearanceController';
import { AuthController } from './controllers/AuthController';

type ViewState = 'student-registration' | 'teacher-login' | 'teacher-dashboard' | 'student-dashboard';

/** Own navigation and the theme/exit controls shared by all screens. */
function App() {
  const [currentView, setCurrentView] = useState<ViewState>('student-registration');
  const [theme, setTheme] = useState(() => AppearanceController.getTheme());

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    AppearanceController.saveTheme(next);
  }

  function logout() {
    AuthController.logout();
    setCurrentView(currentView === 'teacher-dashboard' ? 'teacher-login' : 'student-registration');
  }

  return (
    <div className="app-container" data-theme={theme}>
      <div className="app-toolbar">
        <button className="secondary-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>{theme === 'dark' ? '☀ Светлая тема' : '☾ Тёмная тема'}</button>
        {(currentView === 'teacher-dashboard' || currentView === 'student-dashboard') && <button className="secondary-button" onClick={logout}>Выйти</button>}
      </div>
      {currentView === 'student-registration' && <StudentRegistration onNavigateToTeacher={() => setCurrentView('teacher-login')} onRegisterSuccess={() => setCurrentView('student-dashboard')} />}
      {currentView === 'teacher-login' && <TeacherLogin onLoginSuccess={() => setCurrentView('teacher-dashboard')} onNavigateToStudent={() => setCurrentView('student-registration')} />}
      {currentView === 'teacher-dashboard' && <TeacherDashboard />}
      {currentView === 'student-dashboard' && <StudentDashboard />}
    </div>
  );
}

export default App;
