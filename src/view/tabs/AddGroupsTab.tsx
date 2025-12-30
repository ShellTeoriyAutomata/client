import React, { useState, useEffect } from 'react';
import type { Group } from '../../models/types';
import { GroupController } from '../../controllers/GroupController';

const AddGroupsTab: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    setGroups(GroupController.getGroups());
  }, []);

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName,
      students: []
    };

    GroupController.saveGroup(newGroup);
    setGroups(GroupController.getGroups());
    setNewGroupName('');
  };

  return (
    <div>
      <h3>Управление Группами</h3>
      <form onSubmit={handleAddGroup} className="form-group" style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>Название группы:</label>
          <input 
            type="text" 
            value={newGroupName} 
            onChange={(e) => setNewGroupName(e.target.value)} 
            placeholder="Например: ИВТ-301"
            style={{ width: '100%' }}
          />
        </div>
        <button type="submit">Добавить</button>
      </form>

      <div style={{ marginTop: '2rem' }}>
        <h4>Список групп:</h4>
        {groups.length === 0 ? (
          <p style={{ color: '#888' }}>Групп пока нет</p>
        ) : (
          <div className="list">
            {groups.map(group => (
              <div key={group.id} className="list-item">
                <span>{group.name}</span>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>0 студентов</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddGroupsTab;
