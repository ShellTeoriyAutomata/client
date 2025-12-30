import React, { useState, useEffect } from 'react';
import type { Task } from '../models/types';
import { TaskController } from '../controllers/TaskController';
import StudentTaskView from './StudentTaskView';

interface StudentDashboardProps {
  onLogout: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ onLogout }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    setTasks(TaskController.getTasks());
  }, []);

  if (selectedTask) {
    return <StudentTaskView task={selectedTask} onBack={() => setSelectedTask(null)} />;
  }

  return (
    <div className="container" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Кабинет Студента</h2>
        <button onClick={onLogout} style={{ backgroundColor: '#d32f2f', fontSize: '0.9rem' }}>Выйти</button>
      </div>
      
      <h3>Доступные задания</h3>
      
      {tasks.length === 0 ? (
        <p style={{ color: '#888' }}>Нет доступных заданий.</p>
      ) : (
        <div className="list">
          {tasks.map(task => (
            <div key={task.id} className="list-item">
              <div style={{ textAlign: 'left' }}>
                <strong>{task.title}</strong>
                <div style={{ fontSize: '0.9rem', color: '#ccc' }}>{task.description}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Дедлайн: {task.deadline?.toLocaleDateString()}</div>
              </div>
              <button onClick={() => setSelectedTask(task)}>Выполнить</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
