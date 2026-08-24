import React, { useState } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';

export default function WoodRatesModal({ isOpen, onClose, woodTypes, onSelectWood, onAddWoodType }) {
  const [newWoodName, setNewWoodName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newCategory, setNewCategory] = useState('Hardwood');

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newWoodName || !newRate) return;
    onAddWoodType({
      name: newWoodName,
      default_rate_per_cft: parseFloat(newRate),
      category: newCategory
    });
    setNewWoodName('');
    setNewRate('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <Tag className="panel-icon" size={22} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Wood Species & Rates Catalog (per CFT)
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Add New Rate Form */}
          <form onSubmit={handleAdd} style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1.2fr 1.2fr auto', 
            gap: '8px', 
            padding: '12px', 
            background: '#F8FAFC', 
            borderRadius: '12px', 
            border: '1px solid #E2E8F0',
            alignItems: 'center'
          }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Wood Name (e.g. Oak, Teak)" 
              value={newWoodName}
              onChange={(e) => setNewWoodName(e.target.value)}
              required
              style={{ fontSize: '0.9rem', padding: '8px 10px', fontWeight: 600 }}
            />
            <input 
              type="number" 
              className="input-field font-mono" 
              placeholder="Rate ₹/CFT" 
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              step="any"
              required
              style={{ fontSize: '0.9rem', padding: '8px 10px', fontWeight: 700 }}
            />
            <select 
              className="input-field" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '8px 6px', fontWeight: 600 }}
            >
              <option value="Hardwood">Hardwood</option>
              <option value="Softwood">Softwood</option>
              <option value="Board/Sheet">Board/Sheet</option>
              <option value="Engineered Wood">Engineered</option>
            </select>
            <button type="submit" className="btn btn-success" style={{ padding: '8px 14px', fontWeight: 700 }}>
              <Plus size={16} />
              <span>+ Add</span>
            </button>
          </form>

          <div className="table-responsive">
            <table className="calc-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Wood Species</th>
                  <th>Category</th>
                  <th>Rate per CFT (₹)</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {woodTypes.map((wood, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>{wood.name}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                        {wood.category || 'General'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#B45309', fontSize: '1rem' }}>
                      ₹{parseFloat(wood.default_rate_per_cft || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '5px 12px', fontSize: '0.82rem', fontWeight: 600 }} 
                        onClick={() => { onSelectWood(wood); onClose(); }}
                      >
                        <Check size={14} className="text-emerald" />
                        <span>Use in Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
