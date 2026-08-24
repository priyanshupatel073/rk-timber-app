import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Check, 
  Search, 
  X,
  FileText,
  Trash2
} from 'lucide-react';

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('rk_timber_staff');
    return saved ? JSON.parse(saved) : [];
  });
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', role: '', phone: '', wage: '' });

  useEffect(() => {
    localStorage.setItem('rk_timber_staff', JSON.stringify(employees));
  }, [employees]);

  const presentCount = employees.filter(e => e.status === 'Present').length;
  const absentCount = employees.filter(e => e.status === 'Absent').length;

  const handleToggleAttendance = (id, newStatus) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, status: newStatus } : e));
  };

  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!newEmp.name.trim()) return;
    const added = {
      id: `EMP-0${employees.length + 1}`,
      name: newEmp.name,
      role: newEmp.role || 'Worker',
      phone: newEmp.phone || '—',
      wage: newEmp.wage || '—',
      status: 'Present'
    };
    setEmployees([...employees, added]);
    setShowAddModal(false);
    setNewEmp({ name: '', role: '', phone: '', wage: '' });
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm("Remove this staff member?")) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wrapper fade-in">
      {/* 3 Summary Badges */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-title">Total Staff / कुल कारीगर</span>
          <div className="stat-value">{employees.length}</div>
          <span className="text-muted text-xs">Registered Workers</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Present Today / आज उपस्थित</span>
          <div className="stat-value text-emerald">{presentCount}</div>
          <span className="text-muted text-xs">On Duty</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Absent / आज अनुपस्थित</span>
          <div className="stat-value text-rose">{absentCount}</div>
          <span className="text-muted text-xs">On Leave</span>
        </div>
      </div>

      {/* Staff List & Attendance Table */}
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Users className="panel-icon" size={18} />
            <span>Staff Attendance & Daily Wages (कारीगर हाजिरी व दिहाड़ी)</span>
          </div>

          <div className="page-header-actions">
            <div className="search-box-inline">
              <Search size={14} />
              <input 
                type="text" 
                placeholder="Search staff / खोजें..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ fontWeight: 600 }}>
              <UserPlus size={15} />
              <span>+ Add Worker (नया कारीगर जोड़ें)</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee Name / नाम</th>
                <th>Role / काम</th>
                <th>Phone / फोन</th>
                <th>Wage / दिहाड़ी (₹)</th>
                <th>Today's Attendance / आज की हाजिरी</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td><span className="badge-pill badge-primary font-mono">{emp.id}</span></td>
                    <td className="font-semibold">{emp.name}</td>
                    <td><span className="wood-name-tag">{emp.role}</span></td>
                    <td className="text-muted">{emp.phone}</td>
                    <td className="mono-num font-bold">{emp.wage}</td>
                    <td>
                      <div className="attendance-toggle-group">
                        <button
                          type="button"
                          className={`att-btn present ${emp.status === 'Present' ? 'active' : ''}`}
                          onClick={() => handleToggleAttendance(emp.id, 'Present')}
                        >
                          Present (हाजिर)
                        </button>
                        <button
                          type="button"
                          className={`att-btn absent ${emp.status === 'Absent' ? 'active' : ''}`}
                          onClick={() => handleToggleAttendance(emp.id, 'Absent')}
                        >
                          Absent (गैरहाजिर)
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button"
                        className="btn-icon delete" 
                        style={{ padding: '6px', color: '#E11D48' }}
                        onClick={() => handleDeleteEmployee(emp.id)}
                        title="Delete worker"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    कोई कारीगर नहीं जुड़ा है। कारीगर जोड़ने के लिए ऊपर <strong>"+ Add Worker"</strong> बटन दबाएं।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="panel-header">
              <div className="panel-title">
                <UserPlus className="panel-icon" size={18} />
                <span>Add Worker / नया कारीगर जोड़ें</span>
              </div>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleAddEmployee} className="receipt-form mt-3">
              <div className="field-group">
                <label className="field-label">Worker Name * (कारीगर का नाम)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Raju Mistri / Sunil"
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                  required
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div className="form-grid-2col">
                <div className="field-group">
                  <label className="field-label">Role (काम / पद)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Saw Cutter / Master"
                    value={newEmp.role}
                    onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Phone (मोबाइल नंबर)</label>
                  <input 
                    type="tel" 
                    className="input-field" 
                    placeholder="9876543210"
                    value={newEmp.phone}
                    onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Daily Wage / दिहाड़ी (₹/day या ₹/month)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. ₹900/day या ₹25,000/mo"
                  value={newEmp.wage}
                  onChange={(e) => setNewEmp({ ...newEmp, wage: e.target.value })}
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn btn-success" style={{ fontWeight: 700 }}>
                  <Check size={16} />
                  <span>Save Worker (सेव करें)</span>
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel (रद्द करें)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
