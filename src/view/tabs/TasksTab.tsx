import React, { useState, useEffect } from 'react';
import type { Task, TaskType, TaskVariable } from '../../models/types';
import { TaskController } from '../../controllers/TaskController';

const TasksTab: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('custom');
  const [variables, setVariables] = useState<TaskVariable[]>([]);
  const [template, setTemplate] = useState('');

  useEffect(() => {
    setTasks(TaskController.getTasks());
  }, []);

  // Presets
  const applyPreset = (type: TaskType) => {
    setTaskType(type);
    switch (type) {
      case 'address':
        setVariables([
          { symbol: 'L', allowedValues: 'а-яА-Я', description: 'Буквы' },
          { symbol: 'D', allowedValues: '0-9', description: 'Цифры' }
        ]);
        setTemplate('ул. LLLLL, д. DD, кв. DD');
        break;
      case 'phone':
        setVariables([
          { symbol: 'D', allowedValues: '0-9', description: 'Цифры' }
        ]);
        setTemplate('+7(DDD)DDD-DD-DD');
        break;
      case 'email':
        setVariables([
          { symbol: 'L', allowedValues: 'a-zA-Z', description: 'Буквы' },
          { symbol: 'D', allowedValues: '0-9', description: 'Цифры' }
        ]);
        setTemplate('LLLL@LLLL.LL');
        break;
      case 'custom':
        setVariables([]);
        setTemplate('');
        break;
    }
  };

  const handleAddVariable = () => {
    setVariables([...variables, { symbol: '', allowedValues: '' }]);
  };

  const handleVariableChange = (index: number, field: keyof TaskVariable, value: string) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    setVariables(newVariables);
  };

  const handleRemoveVariable = (index: number) => {
    const newVariables = variables.filter((_, i) => i !== index);
    setVariables(newVariables);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      description,
      type: taskType,
      variables,
      template,
      deadline: new Date()
    };

    TaskController.saveTask(newTask);
    setTasks(TaskController.getTasks());
    setTitle('');
    setDescription('');
    applyPreset('custom'); // Reset form
  };

  const handleDeleteTask = (taskId: string) => {
    TaskController.deleteTask(taskId);
    setTasks(TaskController.getTasks());
  };

  return (
    <div>
      <h3>Задания</h3>
      <form onSubmit={handleAddTask} className="form-column">
        <div className="form-group">
          <label>Название задания:</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="Например: Валидация адреса"
            required 
          />
        </div>

        <div className="form-group">
          <label>Тип шаблона:</label>
          <select 
            value={taskType} 
            onChange={(e) => applyPreset(e.target.value as TaskType)}
            style={{ padding: '0.5rem', borderRadius: '4px', backgroundColor: '#333', color: 'white', border: '1px solid #444' }}
          >
            <option value="custom">Свой шаблон</option>
            <option value="address">Адрес</option>
            <option value="phone">Телефон</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="form-group">
          <label>Переменные (Нетерминалы):</label>
          {variables.map((variable, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text" 
                value={variable.symbol} 
                onChange={(e) => handleVariableChange(index, 'symbol', e.target.value)} 
                placeholder="Символ (x)"
                style={{ width: '80px' }}
                required
              />
              <input 
                type="text" 
                value={variable.allowedValues} 
                onChange={(e) => handleVariableChange(index, 'allowedValues', e.target.value)} 
                placeholder="Значения (0-9, а-я)"
                style={{ flex: 1 }}
                required
              />
              <button type="button" onClick={() => handleRemoveVariable(index)} style={{ backgroundColor: '#d32f2f', padding: '0 0.8rem' }}>X</button>
            </div>
          ))}
          <button type="button" onClick={handleAddVariable} style={{ width: 'fit-content', fontSize: '0.8rem' }}>+ Добавить переменную</button>
        </div>

        <div className="form-group">
          <label>Шаблон:</label>
          <input 
            type="text" 
            value={template} 
            onChange={(e) => setTemplate(e.target.value)} 
            placeholder="Введите шаблон используя символы переменных"
            required 
          />
        </div>

        <div className="form-group">
          <label>Описание:</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows={3}
            placeholder="Дополнительные инструкции..."
          />
        </div>
        <button type="submit">Создать задание</button>
      </form>

      <div style={{ marginTop: '2rem' }}>
        <h4>Активные задания:</h4>
        {tasks.length === 0 ? (
          <p style={{ color: '#888' }}>Заданий пока нет</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <strong>{task.title}</strong>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>{task.deadline?.toLocaleDateString()}</span>
                    <button 
                        onClick={() => handleDeleteTask(task.id)}
                        style={{ 
                            padding: '0.2rem 0.5rem', 
                            backgroundColor: '#d32f2f', 
                            fontSize: '0.8rem',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Удалить
                    </button>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#ccc', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div><strong>Тип:</strong> {task.type}</div>
                <div><strong>Шаблон:</strong> {task.template}</div>
                <div>
                  <strong>Переменные:</strong>
                  <ul style={{ margin: '0.2rem 0 0 1rem', padding: 0 }}>
                    {task.variables.map((v, i) => (
                      <li key={i}>{v.symbol} = [{v.allowedValues}] {v.description ? `(${v.description})` : ''}</li>
                    ))}
                  </ul>
                </div>
                {task.description && <div><strong>Описание:</strong> {task.description}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TasksTab;
