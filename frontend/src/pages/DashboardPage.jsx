import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  IndianRupee,
  Layers,
  Clock,
  AlertCircle,
  PlusCircle,
  Receipt,
  ArrowRight,
  FileText,
  Check,
  RefreshCw,
  Eye,
  Database,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent
} from 'lucide-react';
import apiService from '../config/api';

export default function DashboardPage({ onNavigate, onNewOrder, onSelectOrder }) {
  // Current month in YYYY-MM format
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const [statsData, setStatsData] = useState({
    month: currentMonthStr,
    daily_retail_amount: 0,
    daily_retail_days: 0,
    quick_receipts_amount: 0,
    quick_receipts_count: 0,
    gst_bills_amount: 0,
    gst_bills_count: 0,
    non_gst_bills_amount: 0,
    total_combined_amount: 0,
    wood_types_count: 7,
    recent_orders: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveDB, setIsLiveDB] = useState(false);

  // Month navigation helper
  const handleShiftMonth = (offset) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + offset, 1);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yStr}-${mStr}`);
  };

  // Format month name (e.g. "August 2026")
  const formatMonthTitle = (mStr) => {
    if (!mStr) return '';
    const [year, month] = mStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Helper to match dates in YYYY-MM, DD/MM/YYYY, or ISO format
  const isDateInMonth = (dateVal, targetMonth) => {
    if (!dateVal) return false;
    const str = String(dateVal).trim();
    if (str.startsWith(targetMonth)) return true;
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}`;
        if (formatted === targetMonth) return true;
      } else if (parts[0].length === 4) {
        const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        if (formatted === targetMonth) return true;
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      if (`${yStr}-${mStr}` === targetMonth) return true;
    }
    return false;
  };

  // Comprehensive calculation combining MySQL & local storage
  const calculateComprehensiveStats = (apiData, targetMonth) => {
    try {
      // 1. Daily Retail
      const dailyLocal = JSON.parse(localStorage.getItem('rk_daily_retail_records') || '[]');
      const monthDaily = dailyLocal.filter(d => isDateInMonth(d.date || d.entry_date, targetMonth));

      let dailyDebitTotal = 0;
      let dailyCreditTotal = 0;

      monthDaily.forEach(d => {
        const debits = Array.isArray(d.debit_entries)
          ? d.debit_entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
          : (parseFloat(d.debit_total) || 0);
        const credits = Array.isArray(d.credit_entries)
          ? d.credit_entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
          : (parseFloat(d.credit_total) || 0);

        dailyDebitTotal += debits;
        dailyCreditTotal += credits;
      });

      const localDailySub = dailyDebitTotal - dailyCreditTotal;
      const finalDailyAmount = (apiData && apiData.daily_retail_amount !== undefined && apiData.daily_retail_amount !== 0)
        ? apiData.daily_retail_amount
        : localDailySub;
      const finalDailyDays = (apiData && apiData.daily_retail_days) ? apiData.daily_retail_days : monthDaily.length;

      // 2. Quick Receipts (Deduplicate by bill_no across DB and LocalStorage)
      const receiptsLocal = JSON.parse(localStorage.getItem('rk_timber_saved_receipts') || '[]');
      const monthReceiptsLocal = receiptsLocal.filter(r => isDateInMonth(r.order_date || r.created_at, targetMonth));

      const receiptMap = new Map();

      // Add local receipts
      monthReceiptsLocal.forEach(r => {
        const key = (r.bill_no || `rcp-${r.id}`).toUpperCase().trim();
        receiptMap.set(key, {
          amount: parseFloat(r.grand_total) || 0,
          cft: parseFloat(r.total_cft) || 0
        });
      });

      // Sum all unique quick receipts
      let totalLocalQuickAmount = 0;
      receiptMap.forEach(rec => {
        totalLocalQuickAmount += rec.amount;
      });

      const apiQuickAmount = (apiData && typeof apiData.quick_receipts_amount === 'number') ? apiData.quick_receipts_amount : 0;
      const finalQuickAmount = Math.max(totalLocalQuickAmount, apiQuickAmount);
      const finalQuickCount = Math.max(receiptMap.size, (apiData && apiData.quick_receipts_count) || 0);

      // 3. GST Bills
      const invoicesLocal = JSON.parse(localStorage.getItem('rk_timber_saved_invoices') || '[]');
      const monthGst = invoicesLocal.filter(i =>
        isDateInMonth(i.order_date || i.created_at, targetMonth) &&
        parseFloat(i.tax_percent || 0) > 0 &&
        !(i.bill_no || '').startsWith('RCP-')
      );
      const localGstTotal = monthGst.reduce((sum, i) => sum + (parseFloat(i.grand_total) || 0), 0);
      const apiGstAmount = (apiData && typeof apiData.gst_bills_amount === 'number') ? apiData.gst_bills_amount : 0;
      const finalGstAmount = Math.max(localGstTotal, apiGstAmount);
      const finalGstCount = Math.max(monthGst.length, (apiData && apiData.gst_bills_count) || 0);

      // 4. Grand Combined Total
      const totalCombined = finalDailyAmount + finalQuickAmount + finalGstAmount;

      return {
        month: targetMonth,
        daily_retail_amount: finalDailyAmount,
        daily_retail_debit: dailyDebitTotal,
        daily_retail_credit: dailyCreditTotal,
        daily_retail_net: finalDailyAmount,
        daily_retail_days: finalDailyDays,
        quick_receipts_amount: finalQuickAmount,
        quick_receipts_count: finalQuickCount,
        gst_bills_amount: finalGstAmount,
        gst_bills_count: finalGstCount,
        total_combined_amount: totalCombined,
        wood_types_count: (apiData && apiData.wood_types_count) || 7,
        recent_orders: (apiData && apiData.recent_orders && apiData.recent_orders.length > 0)
          ? apiData.recent_orders
          : invoicesLocal.slice(0, 8)
      };
    } catch (err) {
      console.warn("Comprehensive stats calculation error:", err);
      return apiData || {
        month: targetMonth,
        daily_retail_amount: 0,
        quick_receipts_amount: 0,
        gst_bills_amount: 0,
        total_combined_amount: 0
      };
    }
  };

  const fetchLiveDashboard = async () => {
    setIsLoading(true);
    try {
      const apiData = await apiService.getDashboardStats(selectedMonth);
      const comprehensive = calculateComprehensiveStats(apiData, selectedMonth);
      setStatsData(comprehensive);
      setIsLiveDB(!!apiData);
    } catch (e) {
      const comprehensive = calculateComprehensiveStats(null, selectedMonth);
      setStatsData(comprehensive);
      setIsLiveDB(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveDashboard();
  }, [selectedMonth]);

  const monthLabel = formatMonthTitle(selectedMonth);

  // 4 Requested Metric Cards (Monthly Wise)
  const stats = [
    {
      title: "Daily Retail Amount",
      value: `₹${(statsData.daily_retail_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      subtitle: `${statsData.daily_retail_days || 0} Days Recorded in ${monthLabel}`,
      icon: IndianRupee,
      color: "#059669",
      bgColor: "#ECFDF5",
      badge: "Sub Amount"
    },
    {
      title: "Quick Receipts Amount",
      value: `₹${(statsData.quick_receipts_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      subtitle: `${statsData.quick_receipts_count || 0} Cash Receipts (${monthLabel})`,
      icon: FileText,
      color: "#D97706",
      bgColor: "#FFFBEB",
      badge: "Cash Slips"
    },
    {
      title: "GST Bills Amount",
      value: `₹${(statsData.gst_bills_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      subtitle: `${statsData.gst_bills_count || 0} GST Tax Invoices (${monthLabel})`,
      icon: Percent,
      color: "#4338CA",
      bgColor: "#EEF2FF",
      badge: "Tax Invoices"
    },
    {
      title: "Total Monthly Revenue",
      value: `₹${(statsData.total_combined_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      subtitle: `Sum of All Monthly Sales (${monthLabel})`,
      icon: TrendingUp,
      color: "#1E1B4B",
      bgColor: "#F5F3FF",
      badge: "Grand Total"
    }
  ];

  return (
    <div className="page-wrapper fade-in">
      {/* Top Header Bar with Live DB Status & Monthly Filter Selector */}
      <div className="dashboard-top-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        background: '#FFFFFF',
        padding: '12px 18px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={20} className="text-primary" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Business Overview
          </h2>
        </div>

        {/* Monthly Period Selector */}
        <div className="dashboard-month-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#F8FAFC',
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1.5px solid #CBD5E1',
            flex: '1 1 auto',
            justifyContent: 'space-between'
          }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => handleShiftMonth(-1)}
              title="Previous Month"
              style={{ width: '32px', height: '32px', border: 'none', background: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 6px' }}>
              <Calendar size={15} className="text-primary" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  color: '#1E1B4B',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="button"
              className="btn-icon"
              onClick={() => handleShiftMonth(1)}
              title="Next Month"
              style={{ width: '32px', height: '32px', border: 'none', background: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchLiveDashboard}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 4 Requested Monthly Metric Cards */}
      <div className="stats-grid dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="stat-card dashboard-stat-card"
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                padding: '18px 20px',
                border: '1.5px solid #E2E8F0',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span className="stat-title" style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', display: 'block', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {stat.title}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: stat.color, background: stat.bgColor, padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginTop: '4px' }}>
                    {stat.badge}
                  </span>
                </div>
                <div className="stat-icon-wrapper" style={{ backgroundColor: stat.bgColor, color: stat.color, width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={21} />
                </div>
              </div>
              <div className="stat-value font-mono" style={{ fontSize: '1.65rem', fontWeight: 900, color: stat.color, margin: '6px 0 2px 0', letterSpacing: '-0.5px' }}>
                {stat.value}
              </div>
              <div className="stat-subtitle-clean" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748B' }}>
                {stat.subtitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="quick-actions-bar dashboard-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <button
          className="quick-action-btn primary"
          onClick={() => {
            if (onNewOrder) onNewOrder();
            onNavigate('billing');
          }}
          style={{ padding: '14px', fontWeight: 700 }}
        >
          <PlusCircle size={20} />
          <span>+ New Timber Bill</span>
        </button>

        <button
          className="quick-action-btn"
          onClick={() => onNavigate('add-receipt')}
          style={{ padding: '14px', fontWeight: 600 }}
        >
          <Receipt size={18} />
          <span>+ Quick Cash Receipt</span>
        </button>

        <button
          className="quick-action-btn"
          onClick={() => onNavigate('daily-retail')}
          style={{ padding: '14px', fontWeight: 600 }}
        >
          <span>Daily Retail POS</span>
        </button>
      </div>

      {/* Recent Orders & Bills Section */}
      <div className="glass-panel" style={{ padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText className="panel-icon text-primary" size={20} />
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
              Recent Orders & Bills ({statsData.recent_orders ? statsData.recent_orders.length : 0})
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('billing')} style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>Open Billing Calculator</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* 1. Desktop Table View */}
        <div className="saved-invoices-desktop-table table-responsive">
          <table className="custom-table" style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Wood / Line Items</th>
                <th>Total CFT</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {statsData.recent_orders && statsData.recent_orders.length > 0 ? (
                statsData.recent_orders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <span className="badge-pill badge-primary font-mono" style={{ fontWeight: 800 }}>{ord.bill_no}</span>
                    </td>
                    <td className="font-semibold" style={{ fontSize: '0.95rem', color: '#0F172A' }}>{ord.customer_name}</td>
                    <td className="text-muted">{ord.customer_phone || '—'}</td>
                    <td>
                      <span className="wood-name-tag">{ord.primary_wood || 'Timber'} ({ord.total_pcs || 1} pcs)</span>
                    </td>
                    <td className="mono-num" style={{ fontWeight: 700, color: '#B45309' }}>
                      {parseFloat(ord.total_cft || 0).toFixed(3)} CFT
                    </td>
                    <td className="mono-num font-bold" style={{ fontSize: '1rem', color: '#047857' }}>
                      ₹{parseFloat(ord.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`status-tag ${(ord.payment_status || 'Paid').toLowerCase()}`}>
                        {ord.payment_status === 'Paid' && <Check size={12} />} {ord.payment_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {onSelectOrder && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                          onClick={() => onSelectOrder(ord.id)}
                        >
                          <Eye size={13} />
                          <span>View Bill</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    <p style={{ fontWeight: 600, fontSize: '1rem' }}>No bills found in database yet.</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Click <strong>"+ New Timber Bill"</strong> above to create your first order.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile Card List View */}
        <div className="saved-invoices-mobile-cards">
          {statsData.recent_orders && statsData.recent_orders.length > 0 ? (
            statsData.recent_orders.map((ord) => (
              <div key={ord.id} className="mobile-invoice-card">
                <div className="mobile-invoice-card-header">
                  <span className="badge-pill badge-primary font-mono" style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    {ord.bill_no}
                  </span>
                  <span className={`status-tag ${(ord.payment_status || 'Paid').toLowerCase()}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                    {ord.payment_status === 'Paid' && <Check size={10} />} {ord.payment_status || 'Paid'}
                  </span>
                </div>

                <div className="mobile-invoice-card-body">
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.94rem' }}>
                      {ord.customer_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                      📱 {ord.customer_phone || 'No phone'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '3px' }}>
                      🪵 {ord.primary_wood || 'Timber'} ({ord.total_pcs || 1} pcs)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="mono-num font-bold" style={{ color: '#047857', fontSize: '1.05rem' }}>
                      ₹{parseFloat(ord.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 700, marginTop: '2px' }}>
                      {parseFloat(ord.total_cft || 0).toFixed(2)} CFT
                    </div>
                  </div>
                </div>

                {onSelectOrder && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    <button
                      type="button"
                      className="mobile-card-action-btn edit"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700 }}
                      onClick={() => onSelectOrder(ord.id)}
                    >
                      <Eye size={14} />
                      <span>View & Edit Bill</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', background: '#F8FAFC', borderRadius: '10px' }}>
              <p style={{ fontWeight: 600 }}>No bills recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
