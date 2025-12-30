import React, { useState } from 'react';
import AddGroupsTab from './tabs/AddGroupsTab';
import TasksTab from './tabs/TasksTab';
import ResultsTab from './tabs/ResultsTab';
import SettingsTab from './tabs/SettingsTab';

interface TeacherDashboardProps {
  onLogout: () => void;
}

type Tab = 'groups' | 'tasks' | 'results' | 'settings';

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('groups');

  const renderContent = () => {
    switch (activeTab) {
      case 'groups': return <AddGroupsTab />;
      case 'tasks': return <TasksTab />;
      case 'results': return <ResultsTab />;
      case 'settings': return <SettingsTab onLogout={onLogout} />;
      default: return <div>Select a tab</div>;
    }
  };

  return (
    <div className="container" style={{ maxWidth: '100%' }}>
      <h2>Кабинет Преподавателя</h2>
      
      <div className="dashboard-nav">
        <button 
          className={`nav-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Группы
        </button>
        <button 
          className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Задания
        </button>
        <button 
          className={`nav-tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          Результаты
        </button>
        <button 
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Настройки
        </button>
      </div>

      <div className="tab-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default TeacherDashboard;
