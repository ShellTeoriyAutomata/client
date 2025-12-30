import { useState } from 'react';
import './view/styles/main.css';
import StudentRegistration from './view/StudentRegistration';
import TeacherLogin from './view/TeacherLogin';
import TeacherDashboard from './view/TeacherDashboard';
import StudentDashboard from './view/StudentDashboard';

type ViewState = 'student-registration' | 'teacher-login' | 'teacher-dashboard' | 'student-dashboard';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('student-registration');

  const renderView = () => {
    switch (currentView) {
      case 'student-registration':
        return (
          <StudentRegistration 
            onNavigateToTeacher={() => setCurrentView('teacher-login')}
            onRegisterSuccess={() => setCurrentView('student-dashboard')}
          />
        );
      case 'student-dashboard':
        return (
          <StudentDashboard 
            onLogout={() => setCurrentView('student-registration')}
          />
        );
      case 'teacher-login':
        return (
          <TeacherLogin 
            onLoginSuccess={() => setCurrentView('teacher-dashboard')}
            onNavigateToStudent={() => setCurrentView('student-registration')}
          />
        );
      case 'teacher-dashboard':
        return (
          <TeacherDashboard 
            onLogout={() => setCurrentView('teacher-login')}
          />
        );
      default:
        return <div>Unknown View</div>;
    }
  };

  return (
    <div className="app-container">
      {renderView()}
    </div>
  );
}

export default App;
