import React, { useState } from 'react';
import { X, Calculator, Plus, ArrowDownRight, Check } from 'lucide-react';

export default function CftCalculatorModal({ isOpen, onClose, onInsertIntoInvoice, woodTypes = [] }) {
  const [rows, setRows] = useState([
    { id: 1, woodType: 'Teak (Sagwan)', lengthFt: '', widthIn: '', thickIn: '', pcs: 1, rate: 2200 }
  ]);

  if (!isOpen) return null;

  const handleRowChange = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleAddRow = () => {
    const firstWood = woodTypes[0];
    setRows([...rows, {
      id: Date.now(),
      woodType: firstWood?.name || 'Teak (Sagwan)',
      lengthFt: '',
      widthIn: '',
      thickIn: '',
      pcs: 1,
      rate: firstWood?.default_rate_per_cft || 2200
    }]);
  };

  const handleDeleteRow = (id) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  let totalCft = 0;
  let totalPcs = 0;
  let totalAmount = 0;

  const calculatedRows = rows.map(r => {
    const l = parseFloat(r.lengthFt) || 0;
    const w = parseFloat(r.widthIn) || 0;
    const t = parseFloat(r.thickIn) || 0;
    const p = parseInt(r.pcs) || 0;
    const rate = parseFloat(r.rate) || 0;

    const cftPerPc = (l * w * t > 0) ? (l * w * t) / 144 : 0;
    const itemCft = cftPerPc * p;
    const itemAmt = itemCft * rate;

    totalCft += itemCft;
    totalPcs += p;
    totalAmount += itemAmt;

    return { ...r, cftPerPc, itemCft, itemAmt };
  });

  const handleInsert = () => {
    if (totalCft <= 0) {
      alert("Please enter valid length, width, and thickness measurements.");
      return;
    }

    // Build description from rows
    const descLines = calculatedRows.filter(r => r.itemCft > 0).map(r => 
      `${r.woodType}: ${r.lengthFt}' × ${r.widthIn}" × ${r.thickIn}" (${r.pcs} pcs = ${r.itemCft.toFixed(3)} CFT)`
    ).join('\n');

    const avgRate = totalCft > 0 ? (totalAmount / totalCft) : (calculatedRows[0]?.rate || 0);

    onInsertIntoInvoice({
      description: descLines || `${calculatedRows[0]?.woodType} Sawn Timber`,
      hsn_code: '4407',
      qty: parseFloat(totalCft.toFixed(3)),
      unit: 'CFT',
      rate: parseFloat(avgRate.toFixed(2))
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', background: '#FFF' }}>
        <div className="panel-header">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={20} className="text-amber" />
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Timber Sizing & CFT Assistant (लकड़ी नाप कैलकुलेटर)
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
            Formula: <strong>(Length in Ft × Width in Inches × Thickness in Inches × Pieces) ÷ 144 = CFT</strong>
          </p>

          <div className="table-responsive">
            <table className="calc-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wood Type</th>
                  <th>Length (Ft)</th>
                  <th>Width (In)</th>
                  <th>Thick (In)</th>
                  <th>Pcs</th>
                  <th>CFT</th>
                  <th>Rate (₹)</th>
                  <th>Amount (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {calculatedRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                    <td>
                      <select 
                        className="input-field" 
                        style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                        value={r.woodType}
                        onChange={e => handleRowChange(r.id, 'woodType', e.target.value)}
                      >
                        {woodTypes.map((w, i) => (
                          <option key={i} value={w.name}>{w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0"
                        className="input-field font-mono"
                        style={{ textAlign: 'center', padding: '6px 4px' }}
                        value={r.lengthFt}
                        onChange={e => handleRowChange(r.id, 'lengthFt', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0"
                        className="input-field font-mono"
                        style={{ textAlign: 'center', padding: '6px 4px' }}
                        value={r.widthIn}
                        onChange={e => handleRowChange(r.id, 'widthIn', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0"
                        className="input-field font-mono"
                        style={{ textAlign: 'center', padding: '6px 4px' }}
                        value={r.thickIn}
                        onChange={e => handleRowChange(r.id, 'thickIn', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        min="1"
                        placeholder="1"
                        className="input-field font-mono"
                        style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}
                        value={r.pcs}
                        onChange={e => handleRowChange(r.id, 'pcs', e.target.value)}
                      />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#B45309', textAlign: 'center' }}>
                      {r.itemCft.toFixed(3)}
                    </td>
                    <td>
                      <input 
                        type="number" 
                        placeholder="Rate"
                        className="input-field font-mono"
                        style={{ textAlign: 'center', padding: '6px 4px' }}
                        value={r.rate}
                        onChange={e => handleRowChange(r.id, 'rate', e.target.value)}
                      />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#047857', textAlign: 'right' }}>
                      ₹{r.itemAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button" 
                        className="btn-icon delete" 
                        onClick={() => handleDeleteRow(r.id)}
                        disabled={rows.length <= 1}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRow}>
              <Plus size={14} />
              <span>+ Add Size Row</span>
            </button>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Total Volume:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#B45309', fontSize: '1.1rem' }}>{totalCft.toFixed(3)} CFT</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Total Wood Amount:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#047857', fontSize: '1.1rem' }}>₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleInsert} style={{ fontWeight: 700 }}>
              <ArrowDownRight size={16} />
              <span>Insert into Invoice ({totalCft.toFixed(3)} CFT)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
