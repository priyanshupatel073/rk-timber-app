import React from 'react';
import { Calculator, Plus, Trash2, Copy, RefreshCw } from 'lucide-react';

export default function TimberCalculator({ 
  items, 
  onUpdateItem, 
  onAddItem, 
  onDeleteItem, 
  onDuplicateItem, 
  onClearAll, 
  woodTypes, 
  totalCft, 
  subtotalAmount 
}) {

  const handleRowChange = (id, field, value) => {
    onUpdateItem(id, field, value);
  };

  const handleWoodSelect = (id, e) => {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      onUpdateItem(id, 'wood_type', 'Custom Wood');
      return;
    }
    const found = woodTypes.find(w => w.name === val);
    if (found) {
      onUpdateItem(id, 'wood_type', found.name);
      if (found.default_rate_per_cft > 0) {
        onUpdateItem(id, 'rate_per_cft', found.default_rate_per_cft);
      }
    } else {
      onUpdateItem(id, 'wood_type', val);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      <div className="panel-header" style={{ marginBottom: '12px', paddingBottom: '10px' }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator className="panel-icon" size={20} />
          <div>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
              Timber Sizes & Volume Calculation
            </span>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>
              Formula: (Length Ft × Width In × Thickness In × Pieces) ÷ 144 = Total CFT
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button"
            className="btn btn-secondary btn-sm" 
            style={{ padding: '6px 12px', fontSize: '0.82rem' }} 
            onClick={onClearAll}
            title="Clear all rows"
          >
            <RefreshCw size={13} />
            <span>Clear Rows</span>
          </button>

          <button 
            type="button"
            className="btn btn-primary btn-sm" 
            style={{ padding: '6px 16px', fontSize: '0.88rem', fontWeight: 700 }} 
            onClick={onAddItem}
            title="Add a new timber size row"
          >
            <Plus size={15} />
            <span>+ Add Row</span>
          </button>
        </div>
      </div>

      <div className="table-responsive" style={{ width: '100%', overflowX: 'auto' }}>
        <table className="calc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center', padding: '8px 4px' }}>#</th>
              <th style={{ minWidth: '150px', padding: '8px' }}>Wood Species / Type</th>
              <th style={{ width: '80px', padding: '8px 4px', textAlign: 'center' }}>Length (Ft)</th>
              <th style={{ width: '75px', padding: '8px 4px', textAlign: 'center' }}>Width (In)</th>
              <th style={{ width: '75px', padding: '8px 4px', textAlign: 'center' }}>Thick (In)</th>
              <th style={{ width: '65px', padding: '8px 4px', textAlign: 'center' }}>Pieces</th>
              <th style={{ width: '80px', padding: '8px 4px', textAlign: 'center' }}>CFT/Pc</th>
              <th style={{ width: '90px', padding: '8px 4px', textAlign: 'center' }}>Total CFT</th>
              <th style={{ width: '95px', padding: '8px 4px', textAlign: 'center' }}>Rate (₹)</th>
              <th style={{ width: '110px', padding: '8px 6px', textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ width: '65px', textAlign: 'center', padding: '8px 4px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>No timber sizes added yet.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '3px' }}>Click <strong>"+ Add Row"</strong> above to enter your first size.</p>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const lengthFt = parseFloat(item.length_ft) || 0;
                const widthIn = parseFloat(item.width_in) || 0;
                const thicknessIn = parseFloat(item.thickness_in) || 0;
                const pcs = parseInt(item.pcs) || 0;
                const rate = parseFloat(item.rate_per_cft) || 0;

                const cftPerPc = (lengthFt * widthIn * thicknessIn > 0) ? (lengthFt * widthIn * thicknessIn) / 144 : 0;
                const totalItemCft = cftPerPc * pcs;
                const lineTotal = totalItemCft * rate;

                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748B', padding: '6px 2px' }}>{idx + 1}</td>
                    
                    <td style={{ padding: '6px 4px' }}>
                      <select 
                        className="input-field" 
                        style={{ padding: '6px 8px', fontSize: '0.88rem', fontWeight: 600 }}
                        value={woodTypes.some(w => w.name === item.wood_type) ? item.wood_type : 'CUSTOM'} 
                        onChange={(e) => handleWoodSelect(item.id, e)}
                      >
                        <option value="CUSTOM">Custom Wood Name...</option>
                        {woodTypes.map((w, i) => (
                          <option key={i} value={w.name}>{w.name} (₹{w.default_rate_per_cft})</option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: '6px 4px' }}>
                      <input 
                        type="number" 
                        step="any" 
                        min="0"
                        className="input-field font-mono" 
                        style={{ fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', padding: '6px 2px' }}
                        value={item.length_ft} 
                        onChange={(e) => handleRowChange(item.id, 'length_ft', e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    <td style={{ padding: '6px 4px' }}>
                      <input 
                        type="number" 
                        step="any" 
                        min="0"
                        className="input-field font-mono" 
                        style={{ fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', padding: '6px 2px' }}
                        value={item.width_in} 
                        onChange={(e) => handleRowChange(item.id, 'width_in', e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    <td style={{ padding: '6px 4px' }}>
                      <input 
                        type="number" 
                        step="any" 
                        min="0"
                        className="input-field font-mono" 
                        style={{ fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', padding: '6px 2px' }}
                        value={item.thickness_in} 
                        onChange={(e) => handleRowChange(item.id, 'thickness_in', e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    <td style={{ padding: '6px 4px' }}>
                      <input 
                        type="number" 
                        min="1"
                        className="input-field font-mono" 
                        style={{ fontSize: '0.95rem', fontWeight: 800, textAlign: 'center', padding: '6px 2px', color: '#0F172A' }}
                        value={item.pcs} 
                        onChange={(e) => handleRowChange(item.id, 'pcs', e.target.value)}
                        placeholder="1"
                      />
                    </td>

                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <span className="badge-pill" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                        {cftPerPc.toFixed(3)}
                      </span>
                    </td>

                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <span className="badge-pill" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 800, background: '#FFFBEB', color: '#B45309' }}>
                        {totalItemCft.toFixed(3)}
                      </span>
                    </td>

                    <td style={{ padding: '6px 4px' }}>
                      <input 
                        type="number" 
                        step="any" 
                        min="0"
                        className="input-field font-mono" 
                        style={{ fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', padding: '6px 4px' }}
                        value={item.rate_per_cft} 
                        onChange={(e) => handleRowChange(item.id, 'rate_per_cft', e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                      <span className="badge-pill" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 800, background: '#ECFDF5', color: '#047857' }}>
                        ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center', padding: '6px 2px' }}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                        <button 
                          type="button"
                          className="btn-icon" 
                          style={{ padding: '4px', color: '#475569' }} 
                          onClick={() => onDuplicateItem(item.id)} 
                          title="Duplicate Row"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          type="button"
                          className="btn-icon delete" 
                          style={{ padding: '4px', color: '#E11D48' }} 
                          onClick={() => onDeleteItem(item.id)} 
                          title="Delete Row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Row Summary Toolbar */}
      <div style={{ 
        marginTop: '12px', 
        padding: '10px 14px', 
        background: '#F8FAFC', 
        borderRadius: '10px', 
        border: '1px solid #E2E8F0',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <button 
          type="button"
          className="btn btn-secondary btn-sm" 
          onClick={onAddItem}
          style={{ fontWeight: 600 }}
        >
          <Plus size={14} />
          <span>+ Add Another Size Row</span>
        </button>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 600 }}>
              TOTAL VOLUME
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: '#B45309' }}>
              {totalCft.toFixed(3)} CFT
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 600 }}>
              WOOD SUBTOTAL
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
              ₹{subtotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
