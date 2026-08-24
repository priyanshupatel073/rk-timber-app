import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Eye, RefreshCw } from 'lucide-react';
import apiService from '../config/api';

export default function OrderHistoryModal({ isOpen, onClose, onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const fetchOrders = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiService.getOrders(query);
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.warn("Failed to fetch order history from MySQL backend:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(search);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <FileText className="panel-icon" size={22} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Saved Bills & Order History
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <form onSubmit={handleSearchSubmit} className="search-form-grid" style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by Customer Name, Mobile Phone, or Bill Number..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: '0.95rem', padding: '10px 14px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ fontWeight: 700, padding: '8px 18px' }}>
              <Search size={16} />
              <span>Search</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => { setSearch(''); fetchOrders(''); }}
              title="Reset search"
            >
              <RefreshCw size={16} />
            </button>
          </form>

          <div className="table-responsive">
            <table className="calc-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Customer Name</th>
                  <th>Date</th>
                  <th>Total Volume</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                      Loading past bills from database...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '28px', color: '#64748B' }}>
                      No saved bills found in database.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#B45309' }}>
                        {ord.bill_no}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>{ord.customer_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{ord.customer_phone || 'No phone'}</div>
                      </td>
                      <td style={{ fontSize: '0.88rem', fontWeight: 500 }}>{ord.order_date}</td>
                      <td>
                        <span className="badge-pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, background: '#FFFBEB', color: '#B45309' }}>
                          {parseFloat(ord.total_cft || 0).toFixed(3)} CFT
                        </span>
                      </td>
                      <td>
                        <span className="badge-pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, background: '#ECFDF5', color: '#047857', fontSize: '0.95rem' }}>
                          ₹{parseFloat(ord.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          fontWeight: 700,
                          background: ord.payment_status === 'Paid' ? '#D1FAE5' : '#FEF3C7',
                          color: ord.payment_status === 'Paid' ? '#047857' : '#B45309'
                        }}>
                          {ord.payment_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '5px 12px', fontSize: '0.85rem', fontWeight: 600 }} 
                          onClick={() => { onSelectOrder(ord.id); onClose(); }}
                        >
                          <Eye size={14} />
                          <span>View Bill</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
