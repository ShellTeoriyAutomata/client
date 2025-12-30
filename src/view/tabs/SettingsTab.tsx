import React from 'react';

interface SettingsTabProps {
  onLogout: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ onLogout }) => {
  return (
    <div>
      <h3>Настройки</h3>
      <div className="settings-content">
        <div className="setting-item">
            <label>Темная тема</label>
            <input type="checkbox" defaultChecked />
        </div>
        <div className="setting-item">
            <label>Уведомления</label>
            <input type="checkbox" defaultChecked />
        </div>
      </div>
      <button onClick={onLogout} style={{ marginTop: '20px', backgroundColor: '#d32f2f' }}>Выйти из аккаунта</button>
    </div>
  );
};

export default SettingsTab;
