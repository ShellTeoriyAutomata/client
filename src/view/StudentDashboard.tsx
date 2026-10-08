import { useState } from 'react';
import { TaskController } from '../controllers/TaskController';
import type { Task } from '../models/types';
import StudentTaskView from './StudentTaskView';

/** Let a student choose an assignment and define their own solution. */
export default function StudentDashboard() {
  const [tasks] = useState(() => TaskController.getTasks());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  if (selectedTask) return <StudentTaskView key={selectedTask.id} task={selectedTask} onBack={() => setSelectedTask(null)} />;

  return (
    <div className="container dashboard">
      <h2>Кабинет ученика</h2>
      <h3>Доступные задания</h3>
      {tasks.length === 0 ? <p className="muted">Нет доступных заданий.</p> : tasks.map(task => (
        <article key={task.id} className="list-item">
          <div><strong>{task.title}</strong><p className="description">{task.description}</p></div>
          <button onClick={() => setSelectedTask(task)}>Выполнить</button>
        </article>
      ))}
    </div>
  );
}
