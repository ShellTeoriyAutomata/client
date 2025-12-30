import React, { useState } from 'react';
import { AuthController } from '../controllers/AuthController';

interface StudentRegistrationProps {
  onNavigateToTeacher: () => void;
  onRegisterSuccess: () => void;
}

const StudentRegistration: React.FC<StudentRegistrationProps> = ({ onNavigateToTeacher, onRegisterSuccess }) => {
  const [fio, setFio] = useState('');
  const [group, setGroup] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (AuthController.registerStudent({ fio, group, password })) {
        onRegisterSuccess();
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2>Регистрация Студента</h2>
      <form onSubmit={handleSubmit} className="form-column">
        <div className="form-group">
          <label>ФИО:</label>
          <input 
            type="text" 
            value={fio} 
            onChange={(e) => setFio(e.target.value)} 
            placeholder="Иванов Иван Иванович"
            required 
          />
        </div>
        <div className="form-group">
          <label>Группа:</label>
          <input 
            type="text" 
            value={group} 
            onChange={(e) => setGroup(e.target.value)} 
            placeholder="Группа 123"
            required 
          />
        </div>
        <div className="form-group">
          <label>Пароль:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit">Зарегистрироваться</button>
      </form>
      <div className="navigation-links">
        <button className="link-button" onClick={onNavigateToTeacher}>
          Перейти к входу для преподавателя
        </button>
      </div>
    </div>
  );
};

export default StudentRegistration;
