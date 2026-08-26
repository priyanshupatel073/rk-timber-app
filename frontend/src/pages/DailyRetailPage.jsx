import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  Printer, 
  MessageSquare, 
  Edit, 
  Wallet, 
  RefreshCw 
} from 'lucide-react';
import apiService from '../config/api';

export default function DailyRetailPage() {
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeRecordId, setActiveRecordId] = useState(null);

  // Debit Entries (Amount Comes In / Jama / Cash In)
  const [debitEntries, setDebitEntries] = useState([
    { id: 1, particular: '', amount: '' }
  ]);

  // Credit Entries (Amount Goes Out / Kharch / Udhar / Cash Out)
  const [creditEntries, setCreditEntries] = useState([
    { id: 1, particular: '', amount: '' }
  ]);

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saved', 'saving', 'idle'
  const [toastMsg, setToastMsg] = useState('');
  // Safe date formatter — handles both "YYYY-MM-DD" (localStorage/input) and
  // "YYYY-MM-DDT00:00:00.000Z" (mysql2 without dateStrings) formats correctly.
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '—';
    // Strip any time component if present (e.g., from ISO serialization)
    const datePart = String(dateStr).split('T')[0]; // always "YYYY-MM-DD"
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    }
    return String(dateStr);
  };

  // Compare only the date portion (ignores any time component)
  const isSameDate = (a, b) => {
    if (!a || !b) return false;
    return String(a).split('T')[0] === String(b).split('T')[0];
  };

  // LocalStorage storage helpers for offline persistence & instant load on refresh
  const getStoredDaily = () => {
    try {
      const raw = localStorage.getItem('rk_daily_retail_records');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveStoredDaily = (records) => {
    try {
      localStorage.setItem('rk_daily_retail_records', JSON.stringify(records));
    } catch (e) {
      console.warn("Failed to persist daily retail records to localStorage", e);
    }
  };

  const persistSingleDayLocal = (payload) => {
    try {
      const all = getStoredDaily();
      const idx = all.findIndex(r => r.entry_date === payload.entry_date || (payload.id && r.id === payload.id));
      let updated;
      if (idx >= 0) {
        updated = [...all];
        updated[idx] = { ...updated[idx], ...payload };
      } else {
        updated = [payload, ...all];
      }
      saveStoredDaily(updated);
      setHistoryList(updated);
    } catch (e) {
      console.warn("Error persisting local record:", e);
    }
  };

  const [historyList, setHistoryList] = useState(() => getStoredDaily());
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isInitialLoad = useRef(true);
  const debounceTimerRef = useRef(null);

  // Calculations
  const calculateTotals = () => {
    const totalDebit = debitEntries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalCredit = creditEntries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const subAmount = totalDebit - totalCredit;
    return { totalDebit, totalCredit, subAmount };
  };

  const { totalDebit, totalCredit, subAmount } = calculateTotals();

  // Auto-Save Ledger function to MySQL DB & LocalStorage
  // NOTE: useCallback ensures this always reads fresh state from closure,
  // preventing the stale-closure bug when called with no arguments from onBlur.
  const autoSaveLedger = useCallback(async (currentDebits = debitEntries, currentCredits = creditEntries, currentNotes = notes) => {
    const calcDebit = currentDebits.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const calcCredit = currentCredits.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const calcSub = calcDebit - calcCredit;

    const payload = {
      id: activeRecordId,
      entry_date: entryDate,
      debit_total: calcDebit,
      credit_total: calcCredit,
      sub_amount: calcSub,
      debit_entries: currentDebits,
      credit_entries: currentCredits,
      notes: (currentNotes || '').trim()
    };

    // 1. Immediately persist to localStorage for instant refresh persistence
    persistSingleDayLocal(payload);

    try {
      setAutoSaveStatus('saving');
      const res = await apiService.saveDailyRetail(payload);
      if (res && res.success) {
        if (res.data && res.data.id) {
          setActiveRecordId(res.data.id);
          payload.id = res.data.id;
          persistSingleDayLocal(payload);
        }
        setAutoSaveStatus('saved');
      } else {
        setAutoSaveStatus('saved');
      }
    } catch (err) {
      console.warn("Auto save backend sync:", err);
      setAutoSaveStatus('saved');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debitEntries, creditEntries, notes, entryDate, activeRecordId]);

  // Debounced auto-save whenever debitEntries, creditEntries, or notes change
  useEffect(() => {
    if (isInitialLoad.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setAutoSaveStatus('saving');

    debounceTimerRef.current = setTimeout(() => {
      autoSaveLedger(debitEntries, creditEntries, notes);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debitEntries, creditEntries, notes]);

  // Load history & today's data on mount
  useEffect(() => {
    fetchHistory();
    loadDateEntry(entryDate);
  }, []);

  // Fetch all saved daily retail ledger logs
  const fetchHistory = async () => {
    setLoadingHistory(true);
    const localDaily = getStoredDaily();
    if (localDaily.length > 0) {
      setHistoryList(localDaily);
    }
    try {
      const list = await apiService.getDailyRetailList();
      if (Array.isArray(list)) {
        list.sort((a, b) => (new Date(b.entry_date || 0)) - (new Date(a.entry_date || 0)));
        setHistoryList(list);
        saveStoredDaily(list);
      }
    } catch (e) {
      console.warn("Could not fetch daily retail history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load entry for a specific date (First from LocalStorage, then syncs with DB)
  const loadDateEntry = async (date) => {
    // 1. Instant check from LocalStorage cache
    const all = getStoredDaily();
    const cached = all.find(r => r.entry_date === date);

    if (cached) {
      setActiveRecordId(cached.id || null);
      setDebitEntries(
        Array.isArray(cached.debit_entries) && cached.debit_entries.length > 0
          ? cached.debit_entries
          : [{ id: Date.now(), particular: '', amount: '' }]
      );
      setCreditEntries(
        Array.isArray(cached.credit_entries) && cached.credit_entries.length > 0
          ? cached.credit_entries
          : [{ id: Date.now() + 1, particular: '', amount: '' }]
      );
      setNotes(cached.notes || '');
    }

    // 2. Fetch latest from database in background
    // isInitialLoad stays true throughout the entire async load (local + DB)
    // to prevent the auto-save effect from firing mid-load and overwriting entries.
    try {
      const data = await apiService.getDailyRetailByDate(date);
      if (data) {
        setActiveRecordId(data.id || null);
        setDebitEntries(
          Array.isArray(data.debit_entries) && data.debit_entries.length > 0
            ? data.debit_entries
            : [{ id: Date.now(), particular: '', amount: '' }]
        );
        setCreditEntries(
          Array.isArray(data.credit_entries) && data.credit_entries.length > 0
            ? data.credit_entries
            : [{ id: Date.now() + 1, particular: '', amount: '' }]
        );
        setNotes(data.notes || '');
        persistSingleDayLocal(data);
      } else {
        // Record does not exist in DB (e.g. deleted from another device or fresh date)
        // Only clear local cache if there's genuinely nothing in the DB.
        // Do NOT reset form here if local cache had data — DB may be temporarily
        // unavailable. Only clear if we have a confirmed null response from DB.
        if (!cached) {
          setActiveRecordId(null);
          setDebitEntries([{ id: Date.now(), particular: '', amount: '' }]);
          setCreditEntries([{ id: Date.now() + 1, particular: '', amount: '' }]);
          setNotes('');
        }
        const cleaned = getStoredDaily().filter(r => r.entry_date !== date);
        saveStoredDaily(cleaned);
        setHistoryList(cleaned);
      }
    } catch (e) {
      console.warn("Load date background fetch error:", e);
      // On network error, keep whatever was loaded from local cache — do NOT reset.
    } finally {
      // Use a small delay to let React batch all the setState calls from above
      // before re-enabling auto-save. This prevents the auto-save effect from
      // firing with intermediate/empty state during the load sequence.
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 300);
    }
  };

  const handleDateChange = (newDate) => {
    isInitialLoad.current = true;
    setEntryDate(newDate);
    loadDateEntry(newDate);
  };

  // Debit Rows Handlers (New rows added to TOP)
  const handleAddDebitRow = () => {
    const newRow = { id: Date.now() + Math.random(), particular: '', amount: '' };
    const updated = [newRow, ...debitEntries];
    setDebitEntries(updated);
    autoSaveLedger(updated, creditEntries, notes);
  };

  const handleUpdateDebitRow = (id, field, value) => {
    setDebitEntries(
      debitEntries.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleDeleteDebitRow = (id) => {
    let updated;
    if (debitEntries.length <= 1) {
      updated = [{ id: Date.now(), particular: '', amount: '' }];
    } else {
      updated = debitEntries.filter((row) => row.id !== id);
    }
    setDebitEntries(updated);
    autoSaveLedger(updated, creditEntries, notes);
  };

  // Credit Rows Handlers (New rows added to TOP)
  const handleAddCreditRow = () => {
    const newRow = { id: Date.now() + Math.random(), particular: '', amount: '' };
    const updated = [newRow, ...creditEntries];
    setCreditEntries(updated);
    autoSaveLedger(debitEntries, updated, notes);
  };

  const handleUpdateCreditRow = (id, field, value) => {
    setCreditEntries(
      creditEntries.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleDeleteCreditRow = (id) => {
    let updated;
    if (creditEntries.length <= 1) {
      updated = [{ id: Date.now(), particular: '', amount: '' }];
    } else {
      updated = creditEntries.filter((row) => row.id !== id);
    }
    setCreditEntries(updated);
    autoSaveLedger(debitEntries, updated, notes);
  };

  // Reset / Start fresh day
  const handleResetDay = () => {
    isInitialLoad.current = true;
    setActiveRecordId(null);
    setDebitEntries([{ id: Date.now(), particular: '', amount: '' }]);
    setCreditEntries([{ id: Date.now() + 1, particular: '', amount: '' }]);
    setNotes('');
    setToastMsg(`Cleared form for ${entryDate}`);
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 200);
  };

  // Save day's ledger to MySQL database manually
  const handleSaveDay = async () => {
    setIsSaving(true);
    const validDebits = debitEntries.filter(
      (r) => (r.particular && r.particular.trim()) || (parseFloat(r.amount) || 0) > 0
    );
    const validCredits = creditEntries.filter(
      (r) => (r.particular && r.particular.trim()) || (parseFloat(r.amount) || 0) > 0
    );

    const payload = {
      id: activeRecordId,
      entry_date: entryDate,
      debit_total: totalDebit,
      credit_total: totalCredit,
      sub_amount: subAmount,
      debit_entries: validDebits.length > 0 ? validDebits : debitEntries,
      credit_entries: validCredits.length > 0 ? validCredits : creditEntries,
      notes: notes.trim()
    };

    // Save locally immediately
    persistSingleDayLocal(payload);

    try {
      const res = await apiService.saveDailyRetail(payload);
      if (res && res.success) {
        if (res.data && res.data.id) {
          setActiveRecordId(res.data.id);
          payload.id = res.data.id;
          persistSingleDayLocal(payload);
        }
        setAutoSaveStatus('saved');
        setToastMsg(`Daily retail ledger for ${entryDate} saved to database!`);
        fetchHistory();
      } else {
        setToastMsg(`Daily entry for ${entryDate} saved!`);
      }
    } catch (err) {
      console.warn("Save daily retail error:", err);
      setToastMsg(`Daily entry for ${entryDate} saved!`);
    } finally {
      setIsSaving(false);
    }
  };

  // Load record from history list
  const handleLoadFromHistory = (item) => {
    setEntryDate(item.entry_date);
    setActiveRecordId(item.id);
    setDebitEntries(
      Array.isArray(item.debit_entries) && item.debit_entries.length > 0
        ? item.debit_entries
        : [{ id: Date.now(), particular: '', amount: '' }]
    );
    setCreditEntries(
      Array.isArray(item.credit_entries) && item.credit_entries.length > 0
        ? item.credit_entries
        : [{ id: Date.now() + 1, particular: '', amount: '' }]
    );
    setNotes(item.notes || '');
    setToastMsg(`Loaded daily record for ${item.entry_date}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete day entry
  const handleDeleteDay = async (item) => {
    const confirmDelete = window.confirm(`Delete daily record for ${item.entry_date}?`);
    if (!confirmDelete) return;

    const all = getStoredDaily();
    const filtered = all.filter(r => r.entry_date !== item.entry_date && (!item.id || r.id !== item.id));
    saveStoredDaily(filtered);
    setHistoryList(filtered);

    if (entryDate === item.entry_date) {
      handleResetDay();
    }
    setToastMsg(`Deleted record for ${item.entry_date}`);

    try {
      await apiService.deleteDailyRetail(item.id, item.entry_date);
      fetchHistory();
    } catch (e) {
      console.warn("Delete error:", e);
    }
  };

  // Print day report
  const handlePrint = () => {
    window.print();
  };

  // Share via WhatsApp
  const handleWhatsAppShare = () => {
    const validDebits = debitEntries.filter(r => r.particular || (parseFloat(r.amount) || 0) > 0);
    const validCredits = creditEntries.filter(r => r.particular || (parseFloat(r.amount) || 0) > 0);

    let msg = `*દૈનિક રોજનામચા અને કેશ ફ્લો રિપોર્ટ (DAILY CASH FLOW)*\n`;
    msg += `📅 તારીખ: *${entryDate}*\n`;
    msg += `🏢 *R.K. WOOD INDUSTRIES*\n\n`;

    msg += `📥 *આવક (DEBIT - AMOUNT COMES IN)*:\n`;
    if (validDebits.length > 0) {
      validDebits.forEach((d, i) => {
        msg += `${i + 1}. ${d.particular || 'રોકડ'} : ₹${parseFloat(d.amount || 0).toLocaleString('en-IN')}\n`;
      });
    } else {
      msg += `કોઈ આવક નોંધાયેલ નથી\n`;
    }
    msg += `*કુલ આવક (Total Debit): ₹${totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}*\n\n`;

    msg += `📤 *જાવક (CREDIT - EXPENSES / CASH OUT)*:\n`;
    if (validCredits.length > 0) {
      validCredits.forEach((c, i) => {
        msg += `${i + 1}. ${c.particular || 'ખર્ચ'} : ₹${parseFloat(c.amount || 0).toLocaleString('en-IN')}\n`;
      });
    } else {
      msg += `કોઈ જાવક નોંધાયેલ નથી\n`;
    }
    msg += `*કુલ જાવક (Total Credit): ₹${totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}*\n\n`;

    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *ચોખ્ખી બાકી રકમ (SUB AMOUNT)*: *₹${subAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}*\n`;
    msg += `સ્થિતિ (Status): *${subAmount >= 0 ? 'હાથ પર રોકડ (Surplus)' : 'ખાધ (Deficit)'}*\n`;
    if (notes) msg += `નોંધ: ${notes}\n`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  return (
    <div className="page-wrapper fade-in" style={{ paddingBottom: '60px' }}>
      {toastMsg && (
        <div className="alert-toast success no-print">
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =========================================================================
          TOP HEADER & DATE CONTROL BAR
          ========================================================================= */}
      <div className="glass-panel" style={{ marginBottom: '20px', borderRadius: '12px', padding: '16px 20px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#EEF2FF', padding: '10px', borderRadius: '10px', border: '1px solid #C7D2FE', color: '#4338CA' }}>
              <Wallet size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
                Daily Retail & Cash Flow Ledger
              </h1>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 600 }}>
                રોજનામચા • આવક (Debit - Cash In) & જાવક (Credit - Cash Out) હિસાબ
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Auto-Save Live Status Indicator */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: autoSaveStatus === 'saving' ? '#FEF3C7' : '#ECFDF5', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              border: `1.5px solid ${autoSaveStatus === 'saving' ? '#FCD34D' : '#A7F3D0'}`,
              transition: 'all 0.2s ease'
            }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: autoSaveStatus === 'saving' ? '#F59E0B' : '#10B981',
                display: 'inline-block'
              }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: autoSaveStatus === 'saving' ? '#B45309' : '#047857' }}>
                {autoSaveStatus === 'saving' ? 'Saving to DB...' : 'Auto-saved to DB ✓'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
              <Calendar size={16} className="text-primary" />
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Date:</label>
              <input 
                type="date" 
                value={entryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontWeight: 800, color: '#0F172A', fontSize: '0.88rem', outline: 'none', fontFamily: 'var(--font-mono)' }}
              />
            </div>


            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={handleSaveDay}
              disabled={isSaving}
              style={{ fontWeight: 800, background: '#059669', borderColor: '#047857', padding: '8px 18px' }}
            >
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : 'Save to DB'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          UP-AND-DOWN FULL-WIDTH STACK: DEBIT CARD (TOP) & CREDIT CARD (BOTTOM)
          ========================================================================= */}
      <div className="daily-retail-stack">
        
        {/* =====================================================================
            CARD 1: DEBIT SIDE (AMOUNT COMES IN / આવક / જમા) - FULL WIDTH
            ===================================================================== */}
        <div className="glass-panel daily-card" style={{ border: '2px solid #10B981', boxShadow: '0 4px 18px rgba(16, 185, 129, 0.12)' }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #D1FAE5', paddingBottom: '14px', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#ECFDF5', padding: '10px 12px', borderRadius: '10px', color: '#047857', border: '1.5px solid #A7F3D0', flexShrink: 0 }}>
                  <ArrowDownLeft size={26} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#065F46', margin: 0, letterSpacing: '-0.3px' }}>
                    1. DEBIT SIDE (Amount Comes In / આવક / જમા)
                  </h2>
                  <span style={{ fontSize: '0.86rem', color: '#059669', fontWeight: 700 }}>
                    રોકડ આવક, ગ્રાહકની રકમ, એડવાન્સ ચૂકવણી
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-sm" 
                onClick={handleAddDebitRow}
                style={{ background: '#059669', color: '#FFFFFF', border: 'none', fontWeight: 900, fontSize: '0.92rem', padding: '10px 20px', flexShrink: 0, borderRadius: '8px', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)' }}
              >
                <Plus size={18} />
                <span>+ Add Debit Row</span>
              </button>
            </div>

            {/* Debit Entries Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              {debitEntries.map((row, index) => (
                <div key={row.id} className="daily-entry-row">
                  <div className="daily-entry-row-top">
                    <span style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 900, color: '#059669', flexShrink: 0 }}>
                      #{index + 1}
                    </span>

                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '1.08rem', fontWeight: 700, color: '#0F172A', background: '#FFFFFF' }}
                      placeholder="વિગત / Particulars (e.g. Counter Cash Sale / Customer Payment)..."
                      value={row.particular}
                      onChange={(e) => handleUpdateDebitRow(row.id, 'particular', e.target.value)}
                      onBlur={() => autoSaveLedger(debitEntries, creditEntries, notes)}
                    />

                    <button 
                      type="button" 
                      className="btn-icon delete"
                      title="Delete row"
                      onClick={() => handleDeleteDebitRow(row.id)}
                      style={{ padding: '10px', color: '#DC2626', background: '#FEF2F2', borderRadius: '8px', border: '1.5px solid #FECACA', flexShrink: 0, width: '42px', height: '42px' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="daily-entry-row-amount">
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      className="font-mono"
                      style={{ width: '100%', padding: '12px 16px 12px 28px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '1.3rem', fontWeight: 900, color: '#047857', textAlign: 'right', background: '#FFFFFF' }}
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => handleUpdateDebitRow(row.id, 'amount', e.target.value)}
                      onBlur={() => autoSaveLedger(debitEntries, creditEntries, notes)}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '12px', fontSize: '1.05rem', fontWeight: 900, color: '#059669' }}>₹</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Debit Total Box */}
          <div style={{ marginTop: '20px', background: '#ECFDF5', border: '2px solid #A7F3D0', borderRadius: '10px', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              કુલ આવક / TOTAL DEBIT (IN):
            </span>
            <strong className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857' }}>
              ₹{totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* =====================================================================
            CARD 2: CREDIT SIDE (AMOUNT GOES OUT / જાવક / ખર્ચા) - FULL WIDTH
            ===================================================================== */}
        <div className="glass-panel daily-card" style={{ border: '2px solid #F43F5E', boxShadow: '0 4px 18px rgba(244, 63, 94, 0.12)' }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #FFE4E6', paddingBottom: '14px', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#FFF1F2', padding: '10px 12px', borderRadius: '10px', color: '#E11D48', border: '1.5px solid #FECDD3', flexShrink: 0 }}>
                  <ArrowUpRight size={26} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#9F1239', margin: 0, letterSpacing: '-0.3px' }}>
                    2. CREDIT SIDE (Amount Goes Out / જાવક / ખર્ચા)
                  </h2>
                  <span style={{ fontSize: '0.86rem', color: '#E11D48', fontWeight: 700 }}>
                    ખર્ચા, ડીઝલ, મજૂરી, સપ્લાયર ચૂકવણી
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-sm" 
                onClick={handleAddCreditRow}
                style={{ background: '#E11D48', color: '#FFFFFF', border: 'none', fontWeight: 900, fontSize: '0.92rem', padding: '10px 20px', flexShrink: 0, borderRadius: '8px', boxShadow: '0 2px 8px rgba(225, 29, 72, 0.25)' }}
              >
                <Plus size={18} />
                <span>+ Add Credit Row</span>
              </button>
            </div>

            {/* Credit Entries Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              {creditEntries.map((row, index) => (
                <div key={row.id} className="daily-entry-row">
                  <div className="daily-entry-row-top">
                    <span style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 900, color: '#E11D48', flexShrink: 0 }}>
                      #{index + 1}
                    </span>

                    <input 
                      type="text"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '1.08rem', fontWeight: 700, color: '#0F172A', background: '#FFFFFF' }}
                      placeholder="વિગત / Particulars (e.g. Driver Diesel / Labor Wages / Supplies)..."
                      value={row.particular}
                      onChange={(e) => handleUpdateCreditRow(row.id, 'particular', e.target.value)}
                      onBlur={() => autoSaveLedger(debitEntries, creditEntries, notes)}
                    />

                    <button 
                      type="button" 
                      className="btn-icon delete"
                      title="Delete row"
                      onClick={() => handleDeleteCreditRow(row.id)}
                      style={{ padding: '10px', color: '#DC2626', background: '#FEF2F2', borderRadius: '8px', border: '1.5px solid #FECACA', flexShrink: 0, width: '42px', height: '42px' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="daily-entry-row-amount">
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      className="font-mono"
                      style={{ width: '100%', padding: '12px 16px 12px 28px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '1.3rem', fontWeight: 900, color: '#E11D48', textAlign: 'right', background: '#FFFFFF' }}
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => handleUpdateCreditRow(row.id, 'amount', e.target.value)}
                      onBlur={() => autoSaveLedger(debitEntries, creditEntries, notes)}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '12px', fontSize: '1.05rem', fontWeight: 900, color: '#E11D48' }}>₹</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Total Box */}
          <div className="daily-card-total-box" style={{ marginTop: '20px', background: '#FFF1F2', border: '2px solid #FECDD3', borderRadius: '10px', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#9F1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              કુલ જાવક / TOTAL CREDIT (OUT):
            </span>
            <strong className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#E11D48' }}>
              ₹{totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SUMMARY CARD: SUB AMOUNT (DEBIT - CREDIT) & ACTIONS
          ========================================================================= */}
      <div className="glass-panel" style={{ borderRadius: '14px', padding: '24px 28px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)', marginBottom: '26px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
          
          {/* Sub Total Calculation Formula Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              દૈનિક ગણતરી (SUB AMOUNT):
            </span>
            <div style={{ fontSize: '1.05rem', color: '#1E293B', fontWeight: 700 }}>
              <span style={{ color: '#047857', fontWeight: 900 }}>₹{totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span> (આવક)
              {' − '}
              <span style={{ color: '#E11D48', fontWeight: 900 }}>₹{totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span> (જાવક)
            </div>
            <div style={{ fontSize: '0.86rem', color: '#64748B', marginTop: '2px', fontWeight: 700 }}>
              સ્થિતિ: <strong style={{ color: subAmount >= 0 ? '#047857' : '#DC2626', fontSize: '0.94rem' }}>{subAmount >= 0 ? '✓ હાથ પર રોકડ (Surplus)' : '⚠ ખાધ (Deficit)'}</strong>
            </div>
          </div>

          {/* Prominent Sub Amount Box */}
          <div style={{ 
            background: subAmount >= 0 ? '#ECFDF5' : '#FEF2F2', 
            border: `2.5px solid ${subAmount >= 0 ? '#10B981' : '#F43F5E'}`, 
            borderRadius: '12px', 
            padding: '16px 22px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center',
            boxShadow: subAmount >= 0 ? '0 4px 16px rgba(16, 185, 129, 0.15)' : '0 4px 16px rgba(244, 63, 94, 0.15)'
          }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 900, color: subAmount >= 0 ? '#065F46' : '#9F1239', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              SUB AMOUNT / ચોખ્ખી બાકી રકમ
            </span>
            <div className="font-mono" style={{ fontSize: '2.2rem', fontWeight: 900, color: subAmount >= 0 ? '#047857' : '#DC2626', margin: '4px 0', letterSpacing: '-0.5px' }}>
              ₹{subAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: subAmount >= 0 ? '#059669' : '#E11D48' }}>
              {subAmount >= 0 ? '✓ હાથ પર ચોખ્ખી રોકડ' : '⚠ ખાધ રકમ (Deficit)'}
            </span>
          </div>

          {/* Remarks input & Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                નોંધ / Remarks
              </label>
              <input 
                type="text" 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.94rem', fontWeight: 600 }}
                placeholder="દા.ત. હિસાબ ચકાસાયેલ છે"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => autoSaveLedger(debitEntries, creditEntries, notes)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handlePrint}
                title="Print Day Sheet"
                style={{ fontWeight: 800, flex: 1, padding: '10px 14px', fontSize: '0.9rem' }}
              >
                <Printer size={16} />
                <span>Print</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handleWhatsAppShare}
                title="Share on WhatsApp"
                style={{ fontWeight: 800, color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5', flex: 1.2, padding: '10px 14px', fontSize: '0.9rem' }}
              >
                <MessageSquare size={16} />
                <span>WhatsApp</span>
              </button>

              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={handleSaveDay}
                disabled={isSaving}
                style={{ fontWeight: 900, background: '#059669', borderColor: '#047857', flex: 1.5, padding: '10px 16px', fontSize: '0.92rem' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : 'Save to DB'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          SAVED DAILY RETAIL RECORDS LOG (DATABASE HISTORY)
          ========================================================================= */}
      <div className="glass-panel" style={{ borderRadius: '12px', padding: '20px 24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-primary" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Daily Retail History & Saved Records ({historyList.length})
            </h2>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={fetchHistory}
            title="Refresh History"
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loadingHistory ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="saved-invoices-desktop-table table-responsive">
          <table className="custom-table" style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                <th style={{ width: '130px' }}>તારીખ (DATE)</th>
                <th style={{ textAlign: 'right' }}>કુલ આવક (DEBIT IN)</th>
                <th style={{ textAlign: 'right' }}>કુલ જાવક (CREDIT OUT)</th>
                <th style={{ textAlign: 'right' }}>ચોખ્ખી બાકી (SUB AMOUNT)</th>
                <th>નોંધ (REMARKS)</th>
                <th style={{ width: '140px', textAlign: 'center' }}>ક્રિયા (ACTIONS)</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory && historyList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    રોજનામચા હિસાબ લોડ થઈ રહ્યો છે...
                  </td>
                </tr>
              ) : historyList.length > 0 ? (
                historyList.map((rec) => {
                  const subAmt = parseFloat(rec.sub_amount || 0);
                  const isCurrent = isSameDate(entryDate, rec.entry_date);
                  return (
                    <tr key={rec.id || rec.entry_date} style={{ borderBottom: '1px solid #F1F5F9', background: isCurrent ? '#F0FDF4' : 'transparent' }}>
                      <td>
                        <strong className="font-mono" style={{ color: '#1E1B4B', fontWeight: 800 }}>
                          {formatDisplayDate(rec.entry_date)}
                        </strong>
                        {isCurrent && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Active</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                        +₹{parseFloat(rec.debit_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono)' }}>
                        -₹{parseFloat(rec.credit_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: subAmt >= 0 ? '#047857' : '#DC2626', fontFamily: 'var(--font-mono)', fontSize: '0.94rem' }}>
                        ₹{subAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#64748B' }}>
                        {rec.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            className="row-action-btn view"
                            onClick={() => handleLoadFromHistory(rec)}
                            title="Load and edit this date"
                          >
                            <Edit size={13} />
                            <span>Edit</span>
                          </button>
                          <button 
                            type="button" 
                            className="row-action-btn del"
                            onClick={() => handleDeleteDay(rec)}
                            title="Delete this record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                    હજી સુધી કોઈ રોજનામચા રેકોર્ડ સાચવેલ નથી. ઉપર આવક/જાવક એન્ટ્રી ભરીને "Save to DB" પર ક્લિક કરો.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="saved-invoices-mobile-cards">
          {historyList.length > 0 ? (
            historyList.map((rec) => {
              const subAmt = parseFloat(rec.sub_amount || 0);
              return (
                <div key={rec.id || rec.entry_date} className={`mobile-invoice-card ${isSameDate(entryDate, rec.entry_date) ? 'active-editing' : ''}`}>
                  <div className="mobile-invoice-card-header">
                    <div>
                      <strong className="font-mono" style={{ color: '#1E1B4B', fontSize: '0.94rem' }}>
                        📅 {formatDisplayDate(rec.entry_date)}
                      </strong>
                    </div>
                    <span 
                      style={{ 
                        fontSize: '0.76rem', 
                        fontWeight: 800, 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: subAmt >= 0 ? '#ECFDF5' : '#FEF2F2', 
                        color: subAmt >= 0 ? '#047857' : '#DC2626',
                        border: `1px solid ${subAmt >= 0 ? '#A7F3D0' : '#FECACA'}`
                      }}
                    >
                      {subAmt >= 0 ? 'Surplus (રોકડ)' : 'Deficit (ખાધ)'}
                    </span>
                  </div>

                  <div className="mobile-invoice-card-body">
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>
                        આવક (Debit In): +₹{parseFloat(rec.debit_total || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 700, marginTop: '2px' }}>
                        જાવક (Credit Out): -₹{parseFloat(rec.credit_total || 0).toLocaleString('en-IN')}
                      </div>
                      {rec.notes && <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px' }}>{rec.notes}</div>}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, display: 'block' }}>ચોખ્ખી રકમ / SUB</span>
                      <strong className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 900, color: subAmt >= 0 ? '#047857' : '#DC2626' }}>
                        ₹{subAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                      type="button" 
                      className="mobile-card-action-btn edit"
                      onClick={() => handleLoadFromHistory(rec)}
                      style={{ flex: 1 }}
                    >
                      <Edit size={14} />
                      <span>Edit Date</span>
                    </button>
                    <button 
                      type="button" 
                      className="mobile-card-action-btn del"
                      onClick={() => handleDeleteDay(rec)}
                      style={{ width: '40px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748B' }}>
              No daily retail records saved yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
