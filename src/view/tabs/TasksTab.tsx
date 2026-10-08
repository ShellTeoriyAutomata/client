import { useState, type FormEvent } from 'react';
import { TaskController } from '../../controllers/TaskController';
import { BrowserFileDownload } from '../../adapters/BrowserFileDownload';

interface TasksTabProps {
  onViewResults: (taskId: string) => void;
}

/** Create title/description assignments and open their submitted results. */
export default function TasksTab({ onViewResults }: TasksTabProps) {
  const [tasks, setTasks] = useState(() => TaskController.getTasks());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  function handleAddTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Заполните название и описание задания.');
      return;
    }
    try {
      setTasks(TaskController.saveTask({ id: crypto.randomUUID(), title: title.trim(), description: description.trim() }));
      setTitle('');
      setDescription('');
      setError('');
    } catch {
      setError('Не удалось сохранить задание. Проверьте доступность локального хранилища.');
    }
  }

  function handleDeleteTask(id: string) {
    try {
      setTasks(TaskController.deleteTask(id));
      setError('');
    } catch {
      setError('Не удалось удалить задание.');
    }
  }

  function handleExportTasks() {
    try {
      TaskController.exportTasks(new BrowserFileDownload());
      setError('');
    } catch {
      setError('Не удалось экспортировать задания.');
    }
  }

  return (
    <section>
      <h3>Новое задание</h3>
      <p className="muted">Опишите условие. Терминалы, нетерминалы и шаблон ученик задаёт при выполнении.</p>
      <form onSubmit={handleAddTask} className="form-column assignment-form">
        <div className="form-group">
          <label htmlFor="task-title">Название задания</label>
          <input id="task-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Например: Проверка номера телефона" required />
        </div>
        <div className="form-group">
          <label htmlFor="task-description">Описание</label>
          <textarea id="task-description" value={description} onChange={event => setDescription(event.target.value)} rows={4} placeholder="Условие и требования к решению" required />
        </div>
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="submit">Создать задание</button>
      </form>
      <h3>Задания ({tasks.length})</h3>
      <div className="actions">
        <button type="button" className="secondary-button" onClick={handleExportTasks} disabled={tasks.length === 0}>Экспорт заданий</button>
      </div>
      {tasks.length === 0 ? <p className="muted">Заданий пока нет.</p> : tasks.map(task => (
        <article key={task.id} className="list-item">
          <div><strong>{task.title}</strong><p className="description">{task.description}</p></div>
          <div className="actions">
            <button onClick={() => onViewResults(task.id)}>Результаты</button>
            <button className="secondary-button" onClick={() => handleDeleteTask(task.id)}>Удалить</button>
          </div>
        </article>
      ))}
    </section>
  );
}
