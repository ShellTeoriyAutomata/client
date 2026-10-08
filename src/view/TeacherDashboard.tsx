import { useState } from 'react';
import TasksTab from './tabs/TasksTab';
import ResultsTab from './tabs/ResultsTab';

/** Present assignment creation and student results in a single dashboard. */
export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'results'>('tasks');
  const [taskFilter, setTaskFilter] = useState('');

  return (
    <div className="container dashboard">
      <h2>Кабинет преподавателя</h2>
      <nav className="dashboard-nav" aria-label="Кабинет преподавателя">
        <button className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} aria-current={activeTab === 'tasks' ? 'page' : undefined} onClick={() => setActiveTab('tasks')}>Задания</button>
        <button className={`nav-tab ${activeTab === 'results' ? 'active' : ''}`} aria-current={activeTab === 'results' ? 'page' : undefined} onClick={() => { setTaskFilter(''); setActiveTab('results'); }}>Результаты</button>
      </nav>
      <div className="tab-content">
        {activeTab === 'tasks' ? <TasksTab onViewResults={id => { setTaskFilter(id); setActiveTab('results'); }} /> : <ResultsTab initialTaskId={taskFilter} />}
      </div>
    </div>
  );
}
