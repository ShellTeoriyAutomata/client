import React, { useState } from 'react';
import { AuthController } from '../controllers/AuthController';

interface TeacherLoginProps {
  onLoginSuccess: () => void;
  onNavigateToStudent: () => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onNavigateToStudent }) => {
  const [login, setLogin] = useState('Преподаватель');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (AuthController.loginTeacher({ login, password })) {
        onLoginSuccess();
    } else {
        alert('Неверный логин');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2>Вход для Преподавателя</h2>
      <form onSubmit={handleSubmit} className="form-column">
        <div className="form-group">
          <label>Логин:</label>
          <input 
            type="text" 
            value={login} 
            onChange={(e) => setLogin(e.target.value)} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Пароль:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="Введите пароль"
          />
        </div>
        <button type="submit">Войти</button>
      </form>
      <div className="navigation-links">
        <button className="link-button" onClick={onNavigateToStudent}>
          Вернуться к регистрации студента
        </button>
      </div>
    </div>
  );
};

export default TeacherLogin;
