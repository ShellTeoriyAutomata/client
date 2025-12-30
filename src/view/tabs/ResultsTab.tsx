import React from 'react';

const ResultsTab: React.FC = () => {
  return (
    <div>
      <h3>Результаты</h3>
      <p>Здесь будет таблица с результатами студентов.</p>
      <div className="list-item">
        <span>Иванов И.И. - Лабораторная 1</span>
        <span style={{ color: '#4caf50' }}>Сдано (5/5)</span>
      </div>
      <div className="list-item">
        <span>Петров П.П. - Лабораторная 1</span>
        <span style={{ color: '#ff9800' }}>На проверке</span>
      </div>
    </div>
  );
};

export default ResultsTab;
