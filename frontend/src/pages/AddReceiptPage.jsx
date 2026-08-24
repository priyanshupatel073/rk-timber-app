import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Save,
  FileText,
  CheckCircle2,
  Calculator,
  Edit,
  FileDown,
  MessageSquare,
  Printer,
  Eye,
  RefreshCw,
  Search,
  Filter,
  X
} from 'lucide-react';
import apiService from '../config/api';
import rkWoodLogo from '../assets/rk_wood_logo.png';
import { generateInvoicePdf, downloadBlob } from '../utils/pdfGenerator';
import { numberToWordsIndian } from '../utils/numberToWords';

// Helper to check if a date string matches a YYYY-MM month
const isDateInMonth = (dateVal, targetMonth) => {
  if (!dateVal || !targetMonth) return true;
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

// Helper to purge incremental typing fragments (e.g. 'N', 'NE', 'NEE' when 'NEEM' exists)
const cleanCategoryList = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  const valid = rawList
    .map(s => typeof s === 'string' ? s.trim().toUpperCase() : '')
    .filter(s => s.length >= 2);
  const unique = Array.from(new Set(valid));
  // Filter out any partial prefix substring if a longer full word is present
  const cleaned = unique.filter(word => !unique.some(other => other !== word && other.startsWith(word)));
  return cleaned;
};

export default function AddReceiptPage({ woodTypes = [] }) {
  // Dynamic Wood Category Dropdown List (Stores only full completed names)
  const [categoryList, setCategoryList] = useState(() => {
    try {
      const stored = localStorage.getItem('rk_timber_wood_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = cleanCategoryList(parsed);
          localStorage.setItem('rk_timber_wood_categories', JSON.stringify(sanitized));
          return sanitized;
        }
      }
    } catch (e) { }
    return [];
  });

  // Commit a full complete category name to dropdown memory
  const handleCommitCategory = (typedValue) => {
    const trimmed = (typedValue || '').trim().toUpperCase();
    if (trimmed && trimmed.length >= 2) {
      setCategoryList(prev => {
        const updated = cleanCategoryList([...prev, trimmed]);
        try {
          localStorage.setItem('rk_timber_wood_categories', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });
    }
  };

  // Edit Mode tracking for Quick Receipts
  const [editingReceiptId, setEditingReceiptId] = useState(null);

  // 1. Customer & Receipt Meta
  const [receiptNo, setReceiptNo] = useState(`RCP-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [notes, setNotes] = useState('');

  // 2. Wooden Size Calculation Rows (Blank by default)
  const [items, setItems] = useState([
    {
      id: 1,
      wood_type: '',
      length_ft: '',
      width_in: '',
      thickness_in: '',
      pcs: 1,
      rate_per_cft: ''
    }
  ]);

  // 3. Extra Charges
  const [cuttingCharges, setCuttingCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper functions for separate Quick Receipts storage
  const getStoredReceipts = () => {
    try {
      const raw = localStorage.getItem('rk_timber_saved_receipts');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveStoredReceipts = (receipts) => {
    try {
      localStorage.setItem('rk_timber_saved_receipts', JSON.stringify(receipts));
    } catch (e) {
      console.warn("Failed to persist quick receipts to localStorage", e);
    }
  };

  // Helper to normalize status values cleanly
  const normalizeStatus = (status) => {
    if (!status) return 'Paid';
    const s = String(status).trim().toLowerCase();
    if (s === 'paid') return 'Paid';
    if (s === 'partial' || s === 'partial payment' || s === 'partial paid') return 'Partial Payment';
    if (s === 'unpaid' || s === 'pending') return 'Unpaid';
    return status;
  };

  // Helper for Payment Status badge & select styling
  const getStatusBadgeStyle = (status) => {
    const norm = normalizeStatus(status);
    if (norm === 'Paid') {
      return { 
        background: '#ECFDF5', 
        color: '#047857', 
        borderColor: '#6EE7B7'
      };
    }
    if (norm === 'Partial Payment') {
      return { 
        background: '#FFFBEB', 
        color: '#B45309', 
        borderColor: '#FCD34D'
      };
    }
    return { 
      background: '#FEF2F2', 
      color: '#DC2626', 
      borderColor: '#FCA5A5'
    };
  };

  // Direct Inline Status Update Handler for saved entries
  const handleQuickStatusChange = async (rec, newStatus) => {
    const normalized = normalizeStatus(newStatus);
    
    // 1. Immediately update Local React State for instantaneous UI feedback
    const updatedList = savedReceipts.map(item => {
      if (item.id === rec.id || item.bill_no === rec.bill_no) {
        return { ...item, payment_status: normalized };
      }
      return item;
    });
    setSavedReceipts(updatedList);

    // 2. Immediately save to LocalStorage
    saveStoredReceipts(updatedList);

    // 3. If currently editing this receipt in the form above, sync form status
    if (editingReceiptId === rec.id || receiptNo === rec.bill_no) {
      setPaymentStatus(normalized);
    }

    // 4. Show friendly toast notification
    setToastMsg(`Status for Receipt #${rec.bill_no} updated to "${normalized}"`);

    // 5. Background sync to MySQL DB
    try {
      await apiService.updateOrderStatus({
        id: (typeof rec.id === 'number' && rec.id < 10000000000) ? rec.id : null,
        bill_no: rec.bill_no,
        payment_status: normalized
      });
    } catch (err) {
      console.warn("Backend status update error (saved locally):", err);
    }
  };

  // Saved Quick Receipts History list
  const [savedReceipts, setSavedReceipts] = useState(() => getStoredReceipts());
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search & Month Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Filtered Receipts based on search and month filter
  const filteredReceipts = savedReceipts.filter(rec => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (rec.bill_no && rec.bill_no.toLowerCase().includes(q)) ||
      (rec.customer_name && rec.customer_name.toLowerCase().includes(q)) ||
      (rec.customer_phone && rec.customer_phone.toLowerCase().includes(q)) ||
      (rec.notes && rec.notes.toLowerCase().includes(q))
    );

    let matchesMonth = true;
    if (monthFilter) {
      const recDate = rec.order_date || rec.created_at || '';
      matchesMonth = isDateInMonth(recDate, monthFilter);
    }

    return matchesSearch && matchesMonth;
  });

  // Active Voucher Data for off-screen PDF / WhatsApp generation
  const [activePdfReceipt, setActivePdfReceipt] = useState(null);
  const hiddenVoucherRef = useRef(null);

  // Fetch only Quick Receipts (strictly separate from Timber Billing invoices)
  useEffect(() => {
    fetchSavedReceipts();
  }, []);

  const fetchSavedReceipts = async () => {
    setLoadingHistory(true);
    const localReceipts = getStoredReceipts();
    if (localReceipts.length > 0) {
      setSavedReceipts(localReceipts);
    }
    try {
      const dbData = await apiService.getOrders();
      if (Array.isArray(dbData)) {
        // Filter strictly quick receipts (starting with RCP- or having Quick Receipt in notes)
        const quickReceiptsFromDb = dbData.filter(
          o => (o.bill_no && o.bill_no.startsWith('RCP-')) || (o.notes && o.notes.includes('Quick Receipt'))
        );

        const dbReceiptNos = new Set(quickReceiptsFromDb.map(o => o.bill_no));
        const combined = [...quickReceiptsFromDb];

        for (const loc of localReceipts) {
          if (!dbReceiptNos.has(loc.bill_no)) {
            combined.push(loc);
          }
        }

        combined.sort((a, b) => (new Date(b.order_date || b.created_at || 0)) - (new Date(a.order_date || a.created_at || 0)));
        setSavedReceipts(combined);
        saveStoredReceipts(combined);
      }
    } catch (e) {
      console.warn("API fetch fallback for quick receipts:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Row Calculation Helper: (L' * W" * T" * Pcs) / 144
  const calculateRow = (item) => {
    const l = parseFloat(item.length_ft) || 0;
    const w = parseFloat(item.width_in) || 0;
    const t = parseFloat(item.thickness_in) || 0;
    const pcs = parseInt(item.pcs) || 0;
    const rate = parseFloat(item.rate_per_cft) || 0;

    const rowCft = (l * w * t * pcs) / 144;
    const rowAmount = rowCft * rate;

    return { rowCft, rowAmount };
  };

  // Grand Totals Calculation
  const calculateTotals = () => {
    let totalPcs = 0;
    let totalCft = 0;
    let woodSubtotal = 0;

    items.forEach((item) => {
      const { rowCft, rowAmount } = calculateRow(item);
      totalPcs += (parseInt(item.pcs) || 0);
      totalCft += rowCft;
      woodSubtotal += rowAmount;
    });

    const cutting = parseFloat(cuttingCharges) || 0;
    const transport = parseFloat(transportCharges) || 0;
    const disc = parseFloat(discount) || 0;

    const grandTotal = Math.max(0, woodSubtotal + cutting + transport - disc);

    return { totalPcs, totalCft, woodSubtotal, grandTotal };
  };

  const { totalPcs, totalCft, woodSubtotal, grandTotal } = calculateTotals();

  // Handlers
  const handleAddItem = () => {
    // Commit existing wood types before adding new row
    items.forEach(it => {
      if (it.wood_type) handleCommitCategory(it.wood_type);
    });

    const newRow = {
      id: Date.now() + Math.random(),
      wood_type: '',
      length_ft: '',
      width_in: '',
      thickness_in: '',
      pcs: 1,
      rate_per_cft: ''
    };
    setItems([newRow, ...items]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(items.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteItem = (id) => {
    if (items.length <= 1) {
      alert("Receipt must have at least one wooden size row.");
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  const handleDuplicateItem = (id) => {
    const target = items.find(it => it.id === id);
    if (target) {
      setItems([...items, { ...target, id: Date.now() + Math.random() }]);
    }
  };

  const handleNewReceipt = () => {
    setEditingReceiptId(null);
    setReceiptNo(`RCP-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`);
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMode('Cash');
    setPaymentStatus('Paid');
    setItems([
      {
        id: Date.now(),
        wood_type: '',
        length_ft: '',
        width_in: '',
        thickness_in: '',
        pcs: 1,
        rate_per_cft: ''
      }
    ]);
    setCuttingCharges(0);
    setTransportCharges(0);
    setDiscount(0);
    setNotes('');
    setToastMsg('Ready for new receipt entry.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save to separate Quick Receipts records and MySQL
  const handleSaveReceipt = async () => {
    if (!customerName.trim()) {
      alert("Please enter Customer Name before saving receipt.");
      return;
    }

    setIsSaving(true);
    // Commit all completed wood type names to memory
    items.forEach(it => {
      if (it.wood_type) handleCommitCategory(it.wood_type);
    });

    const currentId = editingReceiptId || Date.now();
    const currentReceiptNo = receiptNo.startsWith('RCP-') ? receiptNo : `RCP-${receiptNo}`;

    const validItems = items.filter(it => (it.wood_type && it.wood_type.trim()) || (parseFloat(it.length_ft) || 0) > 0 || (parseFloat(it.rate_per_cft) || 0) > 0);
    const itemsToSave = validItems.length > 0 ? validItems : [items[0]];

    const receiptRecord = {
      id: currentId,
      bill_no: currentReceiptNo,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_address: `Payment: ${paymentMode}, Status: ${paymentStatus}${notes ? ` (${notes})` : ''}`,
      order_date: receiptDate,
      items: itemsToSave.map(it => {
        const { rowCft, rowAmount } = calculateRow(it);
        return {
          id: it.id || Date.now() + Math.random(),
          wood_type: it.wood_type || 'Wood Sizing',
          description: `${it.wood_type || 'Wood Sizing'} - ${it.length_ft}' x ${it.width_in}" x ${it.thickness_in}"`,
          length_ft: parseFloat(it.length_ft) || 1,
          width_in: parseFloat(it.width_in) || 1,
          thickness_in: parseFloat(it.thickness_in) || 1,
          pcs: parseInt(it.pcs) || 1,
          cft_per_pc: (parseFloat(it.length_ft) * parseFloat(it.width_in) * parseFloat(it.thickness_in)) / 144 || 0,
          total_cft: rowCft,
          rate_per_cft: parseFloat(it.rate_per_cft) || 0,
          total_amount: rowAmount
        };
      }),
      total_cft: totalCft,
      subtotal: woodSubtotal,
      cutting_charges: parseFloat(cuttingCharges) || 0,
      transport_charges: parseFloat(transportCharges) || 0,
      tax_percent: 0,
      discount: parseFloat(discount) || 0,
      grand_total: grandTotal,
      notes: notes ? `Quick Receipt ${currentReceiptNo} - ${notes}` : `Quick Receipt ${currentReceiptNo}`,
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      created_at: new Date().toISOString()
    };

    // 1. Immediately store to LocalStorage and update state
    const currentList = getStoredReceipts();
    const existingIdx = currentList.findIndex(o => o.id === currentId || o.bill_no === currentReceiptNo || String(o.id) === String(currentId));
    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...currentList];
      updatedList[existingIdx] = receiptRecord;
    } else {
      updatedList = [receiptRecord, ...currentList];
    }

    saveStoredReceipts(updatedList);
    setSavedReceipts(updatedList);
    setEditingReceiptId(currentId);
    setToastMsg(`Receipt #${currentReceiptNo} saved successfully!`);

    // 2. Sync to MySQL in background
    try {
      const payload = {
        ...receiptRecord,
        id: (typeof editingReceiptId === 'number' && editingReceiptId < 10000000000) ? editingReceiptId : null
      };
      const res = await apiService.saveOrder(payload);
      if (res && res.success && res.data && res.data.id) {
        const finalId = res.data.id;
        setEditingReceiptId(finalId);
        const syncedList = updatedList.map(o => o.bill_no === currentReceiptNo ? { ...o, id: finalId } : o);
        saveStoredReceipts(syncedList);
        setSavedReceipts(syncedList);
      }
    } catch (err) {
      console.log("Database sync offline, quick receipt recorded locally.");
    } finally {
      setIsSaving(false);
    }
  };

  // Load a saved receipt into form for viewing / editing
  const handleLoadReceipt = (rec) => {
    setEditingReceiptId(rec.id);
    setReceiptNo(rec.bill_no || `RCP-${Date.now()}`);
    setReceiptDate(rec.order_date || new Date().toISOString().split('T')[0]);
    setCustomerName(rec.customer_name || '');
    setCustomerPhone(rec.customer_phone || '');
    setCuttingCharges(parseFloat(rec.cutting_charges || 0));
    setTransportCharges(parseFloat(rec.transport_charges || 0));
    setDiscount(parseFloat(rec.discount || 0));
    setPaymentStatus(rec.payment_status || 'Paid');
    setPaymentMode(rec.payment_mode || 'Cash');

    const cleanNotes = (rec.notes || '').replace(/^Quick Receipt [^ -]*\s*-\s*/, '').replace(/^Quick Receipt [^ ]*/, '');
    setNotes(cleanNotes);

    if (Array.isArray(rec.items) && rec.items.length > 0) {
      setItems(rec.items.map(it => ({
        id: it.id || Date.now() + Math.random(),
        wood_type: it.wood_type || '',
        length_ft: it.length_ft || '',
        width_in: it.width_in || '',
        thickness_in: it.thickness_in || '',
        pcs: it.pcs || 1,
        rate_per_cft: it.rate_per_cft || it.rate || ''
      })));
    }

    setToastMsg(`Loaded Receipt #${rec.bill_no} for editing`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete a saved receipt
  const handleDeleteReceipt = async (rec) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Receipt #${rec.bill_no}?`);
    if (!confirmDelete) return;

    const filtered = savedReceipts.filter(o => o.id !== rec.id && o.bill_no !== rec.bill_no);
    setSavedReceipts(filtered);
    saveStoredReceipts(filtered);

    if (editingReceiptId === rec.id || receiptNo === rec.bill_no) {
      handleNewReceipt();
    }
    setToastMsg(`Receipt #${rec.bill_no} deleted successfully.`);

    try {
      if (rec.id && typeof rec.id === 'number' && rec.id < 10000000000) {
        await apiService.deleteOrder(rec.id);
      }
    } catch (e) {
      console.warn("Delete order backend sync:", e);
    }
  };

  // Download PDF for a specific saved receipt
  const handleDownloadReceiptPdf = async (rec) => {
    try {
      setIsGeneratingPdf(true);
      setActivePdfReceipt(rec);

      // Allow state to render into hiddenVoucherRef
      setTimeout(async () => {
        if (!hiddenVoucherRef.current) {
          setIsGeneratingPdf(false);
          return;
        }
        const filename = `Receipt_${rec.bill_no}_${(rec.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const { blob } = await generateInvoicePdf(hiddenVoucherRef.current, filename);
        downloadBlob(blob, filename);
        setIsGeneratingPdf(false);
        setActivePdfReceipt(null);
      }, 150);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Could not generate receipt PDF.');
      setIsGeneratingPdf(false);
      setActivePdfReceipt(null);
    }
  };

  // Share a saved receipt on WhatsApp strictly as a PDF file document
  const handleWhatsAppShareReceipt = async (rec) => {
    try {
      setIsGeneratingPdf(true);
      setActivePdfReceipt(rec);

      setTimeout(async () => {
        if (!hiddenVoucherRef.current) {
          setIsGeneratingPdf(false);
          return;
        }

        const cleanBill = (rec.bill_no || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanCust = (rec.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Receipt_${cleanBill}_${cleanCust}.pdf`;

        // 1. Generate the exact official PDF document file
        const { blob } = await generateInvoicePdf(hiddenVoucherRef.current, filename);
        const pdfFile = new File([blob], filename, { type: 'application/pdf' });

        // 2. Resolve customer's phone number if available
        let rawPhone = (rec.customer_phone || '').trim();
        let phoneClean = rawPhone.replace(/\D/g, '');
        if (phoneClean.startsWith('0') && phoneClean.length === 11) phoneClean = phoneClean.slice(1);
        const validPhone = phoneClean.length === 10 
          ? `91${phoneClean}` 
          : (phoneClean.length === 12 && phoneClean.startsWith('91') ? phoneClean : (phoneClean.length >= 10 ? phoneClean : ''));

        // 3. Primary Mobile Share: Sends the actual PDF document file directly into WhatsApp
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Payment Receipt #${rec.bill_no}`
            });
            setToastMsg(`PDF Receipt #${rec.bill_no} shared directly to WhatsApp!`);
            setIsGeneratingPdf(false);
            setActivePdfReceipt(null);
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') {
              setIsGeneratingPdf(false);
              setActivePdfReceipt(null);
              return;
            }
          }
        }

        // 4. Desktop / Fallback: Download the PDF document and open direct WhatsApp chat to customer number
        downloadBlob(blob, filename);
        const waUrl = validPhone 
          ? `https://api.whatsapp.com/send?phone=${validPhone}` 
          : `https://web.whatsapp.com/`;
        window.open(waUrl, '_blank');

        setToastMsg(`PDF Receipt "${filename}" downloaded! Attach it in WhatsApp.`);
        setIsGeneratingPdf(false);
        setActivePdfReceipt(null);
      }, 300);
    } catch (err) {
      console.error('WhatsApp error:', err);
      alert('Failed to generate receipt PDF for WhatsApp: ' + err.message);
      setIsGeneratingPdf(false);
      setActivePdfReceipt(null);
    }
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

      {/* Active loaded receipt indicator */}
      {editingReceiptId && (
        <div className="active-loaded-invoice-banner no-print">
          <div>
            <strong>✏️ Editing Quick Receipt #{receiptNo}</strong> &bull; Customer: {customerName || 'N/A'}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleNewReceipt}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            + Create New Receipt
          </button>
        </div>
      )}

      {/* =========================================================================
          CARD 1: WOODEN SIZES & CUTSIZE CALCULATOR CARD (FIRST)
          ========================================================================= */}
      <div className="glass-panel quick-receipt-panel" style={{ marginBottom: '20px', borderRadius: '12px', padding: '20px 24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={20} className="text-amber" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                1. Wooden Sizes & Price Calculation
              </h2>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px', fontWeight: 600 }}>
              Formula: (Length' × Width" × Thick" × Pcs) ÷ 144 = CFT • CFT × Rate = Amount
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', padding: '5px 12px', borderRadius: '20px', border: '1px solid #FDE68A' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E' }}>Receipt #:</span>
              <strong className="font-mono" style={{ fontSize: '0.9rem', color: '#B45309', fontWeight: 800 }}>{receiptNo}</strong>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleNewReceipt}
              title="Clear form and start new receipt"
              style={{ fontWeight: 700, background: '#FFFFFF', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} />
              <span>New Receipt</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAddItem}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>+ Add Wooden Size</span>
            </button>
          </div>
        </div>

        {/* Desktop Calculation Table */}
        <div className="receipt-table-desktop table-responsive" style={{ width: '100%', overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          <table className="custom-table" style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '180px' }}>Category / Wood Type</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Length (Ft)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Width (In)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Thick (In)</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Pieces</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Rate / CFT (₹)</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Volume (CFT)</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Total (₹)</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const { rowCft, rowAmount } = calculateRow(item);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748B' }}>{index + 1}</td>
                    
                    {/* Category / Wood Type (Blank by default, dynamic datalist) */}
                    <td>
                      <input
                        type="text"
                        list={`wood-categories-datalist-${item.id}`}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, background: '#FFFFFF' }}
                        placeholder="Type category..."
                        value={item.wood_type}
                        onChange={(e) => handleUpdateItem(item.id, 'wood_type', e.target.value)}
                        onBlur={(e) => handleCommitCategory(e.target.value)}
                      />
                      <datalist id={`wood-categories-datalist-${item.id}`}>
                        {categoryList.map((catName, i) => (
                          <option key={i} value={catName} />
                        ))}
                      </datalist>
                    </td>

                    {/* Length (Feet) */}
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        placeholder="Ft"
                        value={item.length_ft}
                        onChange={(e) => handleUpdateItem(item.id, 'length_ft', e.target.value)}
                      />
                    </td>

                    {/* Width (Inches) */}
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        placeholder="In"
                        value={item.width_in}
                        onChange={(e) => handleUpdateItem(item.id, 'width_in', e.target.value)}
                      />
                    </td>

                    {/* Thickness (Inches) */}
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        placeholder="In"
                        value={item.thickness_in}
                        onChange={(e) => handleUpdateItem(item.id, 'thickness_in', e.target.value)}
                      />
                    </td>

                    {/* Pieces */}
                    <td>
                      <input
                        type="number"
                        min="1"
                        style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 800, color: '#1E1B4B' }}
                        placeholder="Pcs"
                        value={item.pcs}
                        onChange={(e) => handleUpdateItem(item.id, 'pcs', e.target.value)}
                      />
                    </td>

                    {/* Rate / CFT */}
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="font-mono"
                        style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        placeholder="Rate"
                        value={item.rate_per_cft}
                        onChange={(e) => handleUpdateItem(item.id, 'rate_per_cft', e.target.value)}
                      />
                    </td>

                    {/* Calculated CFT */}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)' }}>
                      {rowCft.toFixed(3)}
                    </td>

                    {/* Calculated Amount */}
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', fontSize: '0.94rem' }}>
                      ₹{rowAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Duplicate Size Row"
                          onClick={() => handleDuplicateItem(item.id)}
                          style={{ padding: '4px', color: '#4338CA' }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon delete"
                          title="Delete Row"
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ padding: '4px', color: '#DC2626' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Clean, Stacked Size Cards (100% In One Frame, Zero Horizontal Scroll) */}
        <div className="receipt-items-mobile-list">
          {items.map((item, index) => {
            const { rowCft, rowAmount } = calculateRow(item);
            return (
              <div key={item.id} className="mobile-item-entry-card">
                {/* Header: Row # + Wood Type + Action Buttons */}
                <div className="mobile-item-entry-header">
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4338CA', background: '#EEF2FF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #C7D2FE', flexShrink: 0 }}>
                    #{index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      list={`wood-categories-datalist-mob-${item.id}`}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, background: '#FFFFFF', fontSize: '0.86rem' }}
                      placeholder="Category / Wood Type..."
                      value={item.wood_type}
                      onChange={(e) => handleUpdateItem(item.id, 'wood_type', e.target.value)}
                      onBlur={(e) => handleCommitCategory(e.target.value)}
                    />
                    <datalist id={`wood-categories-datalist-mob-${item.id}`}>
                      {categoryList.map((catName, i) => (
                        <option key={i} value={catName} />
                      ))}
                    </datalist>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Duplicate Size Row"
                      onClick={() => handleDuplicateItem(item.id)}
                      style={{ padding: '6px', color: '#4338CA', background: '#EEF2FF', borderRadius: '6px' }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon delete"
                      title="Delete Row"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ padding: '6px', color: '#DC2626', background: '#FEF2F2', borderRadius: '6px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 4 Dimension Inputs: Length (Ft), Width (In), Thick (In), Pieces */}
                <div className="mobile-item-entry-dims">
                  <div>
                    <label>Length (Ft)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      style={{ width: '100%', textAlign: 'center', padding: '6px 2px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.84rem' }}
                      placeholder="Ft"
                      value={item.length_ft}
                      onChange={(e) => handleUpdateItem(item.id, 'length_ft', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Width (In)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      style={{ width: '100%', textAlign: 'center', padding: '6px 2px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.84rem' }}
                      placeholder="In"
                      value={item.width_in}
                      onChange={(e) => handleUpdateItem(item.id, 'width_in', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Thick (In)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      style={{ width: '100%', textAlign: 'center', padding: '6px 2px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.84rem' }}
                      placeholder="In"
                      value={item.thickness_in}
                      onChange={(e) => handleUpdateItem(item.id, 'thickness_in', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Pieces</label>
                    <input
                      type="number"
                      min="1"
                      style={{ width: '100%', textAlign: 'center', padding: '6px 2px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}
                      placeholder="Pcs"
                      value={item.pcs}
                      onChange={(e) => handleUpdateItem(item.id, 'pcs', e.target.value)}
                    />
                  </div>
                </div>

                {/* Calculation Bar: Rate / CFT, Volume, Row Total */}
                <div className="mobile-item-entry-calc">
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '1px' }}>Rate / CFT</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="font-mono"
                      style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.82rem' }}
                      placeholder="Rate"
                      value={item.rate_per_cft}
                      onChange={(e) => handleUpdateItem(item.id, 'rate_per_cft', e.target.value)}
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '1px' }}>Volume</span>
                    <strong className="font-mono" style={{ fontSize: '0.84rem', color: '#B45309', fontWeight: 800 }}>
                      {rowCft.toFixed(3)} <span style={{ fontSize: '0.68rem' }}>CFT</span>
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '1px' }}>Amount</span>
                    <strong className="font-mono" style={{ fontSize: '0.9rem', color: '#047857', fontWeight: 900 }}>
                      ₹{rowAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra Charges & Adjustments Row */}
        <div className="quick-receipt-extra-charges" style={{ marginTop: '16px', background: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Cutting / Sawing (₹)
            </label>
            <input
              type="number"
              min="0"
              className="font-mono"
              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
              placeholder="0"
              value={cuttingCharges}
              onChange={(e) => setCuttingCharges(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Transport / Loading (₹)
            </label>
            <input
              type="number"
              min="0"
              className="font-mono"
              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
              placeholder="0"
              value={transportCharges}
              onChange={(e) => setTransportCharges(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Discount (₹)
            </label>
            <input
              type="number"
              min="0"
              className="font-mono text-rose"
              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Remarks / Notes
            </label>
            <input
              type="text"
              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
              placeholder="e.g. Delivery by evening"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: CUSTOMER DETAILS & RECEIPT INFO CARD (BELOW WOODEN SIZES)
          ========================================================================= */}
      <div className="glass-panel quick-receipt-panel" style={{ marginBottom: '24px', borderRadius: '12px', padding: '20px 24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-primary" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              2. Customer Details & Receipt Info
            </h2>
          </div>
        </div>

        <div className="quick-receipt-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div className="field-group">
            <label className="field-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Customer Name *
            </label>
            <input
              type="text"
              className="input-field"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 700, textTransform: 'uppercase' }}
              placeholder="e.g. Swastik Enterprise / Ramesh Kumar"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Mobile Number (WhatsApp)
            </label>
            <input
              type="tel"
              className="input-field font-mono"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              placeholder="e.g. 9879810196"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Receipt Date
            </label>
            <input
              type="date"
              className="input-field font-mono"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 600 }}
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Payment Status
            </label>
            <select
              className="input-field"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 700, background: '#FFFFFF' }}
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial Payment">Partial Payment</option>
            </select>
          </div>
        </div>

        {/* Live Totals & Action Bar */}
        <div className="quick-receipt-actions-bar" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <div className="quick-receipt-totals-group" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.86rem', color: '#475569' }}>
              Total Pieces: <strong style={{ color: '#0F172A' }}>{totalPcs} Pcs</strong>
            </div>
            <div style={{ fontSize: '0.86rem', color: '#475569' }}>
              Total Volume: <strong className="font-mono" style={{ color: '#B45309', fontWeight: 800 }}>{totalCft.toFixed(3)} CFT</strong>
            </div>
            <div className="grand-total-highlight" style={{ fontSize: '1.15rem', color: '#047857', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
              Grand Total: ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="quick-receipt-btn-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleNewReceipt}
              title="Clear & Start New Receipt"
              style={{ fontWeight: 700 }}
            >
              <RotateCcw size={15} />
              <span>New Receipt</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const currentRec = {
                  id: editingReceiptId || Date.now(),
                  bill_no: receiptNo,
                  order_date: receiptDate,
                  customer_name: customerName,
                  customer_phone: customerPhone,
                  payment_status: paymentStatus,
                  payment_mode: paymentMode,
                  cutting_charges: cuttingCharges,
                  transport_charges: transportCharges,
                  discount: discount,
                  total_cft: totalCft,
                  grand_total: grandTotal,
                  notes: notes,
                  items: items
                };
                handleWhatsAppShareReceipt(currentRec);
              }}
              disabled={isGeneratingPdf}
              style={{ background: '#059669', color: '#FFF', borderColor: '#059669', fontWeight: 700, padding: '7px 15px' }}
              title="Share active receipt on WhatsApp"
            >
              <MessageSquare size={15} />
              <span>WhatsApp (PDF)</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveReceipt}
              disabled={isSaving}
              style={{ fontWeight: 800, padding: '7px 18px', background: '#2563EB', borderColor: '#1D4ED8' }}
            >
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : 'Save to DB'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SAVED QUICK RECEIPTS & RECORDS (VIEW MODE)
          ========================================================================= */}
      <div className="glass-panel quick-receipt-panel" style={{ marginTop: '24px', borderRadius: '12px', padding: '20px 24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} className="text-primary" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Saved Quick Receipts & Records ({filteredReceipts.length}{filteredReceipts.length !== savedReceipts.length ? ` of ${savedReceipts.length}` : ''})
            </h2>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchSavedReceipts}
            title="Refresh Quick Receipts List"
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loadingHistory ? 'spin' : ''} />
            <span>Refresh List</span>
          </button>
        </div>

        {/* Search & Monthly Filter Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
          background: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0'
        }}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <Search size={16} style={{ color: '#64748B', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by customer name, phone, or receipt #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: '0.86rem', fontWeight: 600, color: '#0F172A' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#94A3B8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Monthly View Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '5px 10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
              <Filter size={15} style={{ color: '#4338CA' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Month:</span>
              <input
                type="month"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.84rem', fontWeight: 800, color: '#1E1B4B', cursor: 'pointer', fontFamily: 'inherit' }}
              />
            </div>

            {monthFilter && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setMonthFilter('')}
                style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, background: '#FFFFFF' }}
              >
                All Months
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="saved-invoices-desktop-table table-responsive">
          <table className="custom-table" style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                <th style={{ width: '110px' }}>RECEIPT #</th>
                <th style={{ width: '110px' }}>DATE</th>
                <th>CUSTOMER NAME</th>
                <th>MOBILE NUMBER</th>
                <th style={{ width: '120px', textAlign: 'center' }}>VOLUME / PCS</th>
                <th style={{ width: '130px', textAlign: 'right' }}>AMOUNT (₹)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>STATUS</th>
                <th style={{ width: '220px', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory && savedReceipts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    Loading saved quick receipts...
                  </td>
                </tr>
              ) : filteredReceipts.length > 0 ? (
                filteredReceipts.map(rec => (
                  <tr key={rec.id || rec.bill_no} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td>
                      <strong className="font-mono" style={{ color: '#1E1B4B', fontWeight: 800 }}>
                        {rec.bill_no}
                      </strong>
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.82rem' }}>
                      {rec.order_date ? rec.order_date.split('-').reverse().join('/') : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                      {rec.customer_name}
                    </td>
                    <td className="font-mono" style={{ color: '#334155' }}>
                      {rec.customer_phone || '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: '#B45309', fontWeight: 700 }}>{parseFloat(rec.total_cft || 0).toFixed(2)} CFT</span>
                      {rec.items && <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>({rec.items.reduce((s, it) => s + (parseInt(it.pcs) || 0), 0)} Pcs)</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', fontSize: '0.94rem' }}>
                      ₹{parseFloat(rec.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', position: 'relative' }}>
                        <select 
                          className="quick-status-badge-select"
                          value={normalizeStatus(rec.payment_status)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleQuickStatusChange(rec, e.target.value);
                          }}
                          style={{
                            ...getStatusBadgeStyle(rec.payment_status || 'Paid'),
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            outline: 'none',
                            border: '1.5px solid',
                            transition: 'all 0.15s ease-in-out',
                            textAlign: 'center',
                            appearance: 'auto'
                          }}
                          title="Click to change payment status"
                        >
                          <option value="Paid" style={{ background: '#FFFFFF', color: '#047857', fontWeight: 700 }}>✓ Paid</option>
                          <option value="Unpaid" style={{ background: '#FFFFFF', color: '#DC2626', fontWeight: 700 }}>✗ Unpaid</option>
                          <option value="Partial Payment" style={{ background: '#FFFFFF', color: '#B45309', fontWeight: 700 }}>⏳ Partial Payment</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="invoice-row-actions" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="row-action-btn view"
                          title="View / Edit Receipt"
                          onClick={() => handleLoadReceipt(rec)}
                        >
                          <Edit size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn pdf"
                          title="Download Receipt PDF"
                          disabled={isGeneratingPdf}
                          onClick={() => handleDownloadReceiptPdf(rec)}
                        >
                          <FileDown size={13} />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn wa"
                          title="Share on WhatsApp"
                          disabled={isGeneratingPdf}
                          onClick={() => handleWhatsAppShareReceipt(rec)}
                        >
                          <MessageSquare size={13} />
                          <span>WA</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn del"
                          title="Delete Receipt"
                          onClick={() => handleDeleteReceipt(rec)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                    <p style={{ fontWeight: 600 }}>{searchQuery || monthFilter ? 'No receipts found matching your search/month filter.' : 'No quick receipts saved yet.'}</p>
                    {(searchQuery || monthFilter) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setSearchQuery(''); setMonthFilter(''); }}
                        style={{ marginTop: '6px', fontSize: '0.78rem' }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="saved-invoices-mobile-cards">
          {loadingHistory && savedReceipts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748B' }}>
              Loading saved receipts...
            </div>
          ) : filteredReceipts.length > 0 ? (
            filteredReceipts.map(rec => (
              <div
                key={rec.id || rec.bill_no}
                className={`mobile-invoice-card ${editingReceiptId === rec.id ? 'active-editing' : ''}`}
              >
                <div className="mobile-invoice-card-header">
                  <div>
                    <strong className="font-mono" style={{ color: '#1E1B4B', fontSize: '0.96rem' }}>
                      {rec.bill_no}
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: '#64748B', display: 'block' }}>
                      {rec.order_date ? rec.order_date.split('-').reverse().join('/') : '—'}
                    </span>
                  </div>
                  <select 
                    className="quick-status-badge-select"
                    value={normalizeStatus(rec.payment_status)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleQuickStatusChange(rec, e.target.value);
                    }}
                    style={{
                      ...getStatusBadgeStyle(rec.payment_status || 'Paid'),
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      outline: 'none',
                      border: '1.5px solid',
                      transition: 'all 0.15s ease-in-out',
                      textAlign: 'center',
                      appearance: 'auto'
                    }}
                    title="Click to change payment status"
                  >
                    <option value="Paid" style={{ background: '#FFFFFF', color: '#047857', fontWeight: 700 }}>✓ Paid</option>
                    <option value="Unpaid" style={{ background: '#FFFFFF', color: '#DC2626', fontWeight: 700 }}>✗ Unpaid</option>
                    <option value="Partial Payment" style={{ background: '#FFFFFF', color: '#B45309', fontWeight: 700 }}>⏳ Partial Payment</option>
                  </select>
                </div>

                <div className="mobile-invoice-card-body">
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.94rem', textTransform: 'uppercase' }}>
                      {rec.customer_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                      📱 {rec.customer_phone || 'No phone'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                      ₹{parseFloat(rec.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 700 }}>
                      {parseFloat(rec.total_cft || 0).toFixed(2)} CFT
                    </div>
                  </div>
                </div>

                <div className="mobile-invoice-actions">
                  <button
                    type="button"
                    className="mobile-card-action-btn edit"
                    onClick={() => handleLoadReceipt(rec)}
                  >
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn wa"
                    disabled={isGeneratingPdf}
                    onClick={() => handleWhatsAppShareReceipt(rec)}
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn pdf"
                    disabled={isGeneratingPdf}
                    onClick={() => handleDownloadReceiptPdf(rec)}
                  >
                    <FileDown size={14} />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn del"
                    onClick={() => handleDeleteReceipt(rec)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
              No quick receipts saved yet.
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          OFF-SCREEN RENDER CANVAS FOR QUICK RECEIPT PDF & WHATSAPP GENERATION
          ========================================================================= */}
      {activePdfReceipt && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -100 }}>
          <div
            ref={hiddenVoucherRef}
            className="invoice-paper-canvas receipt-paper-slip"
            style={{
              background: '#FFFFFF',
              border: '2px solid #1E1B4B',
              borderRadius: '6px',
              padding: '28px 32px',
              width: '800px',
              maxWidth: '800px',
              color: '#000000',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
          >
            {/* Header with Logo */}
            <div className="invoice-header-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '14px', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <img
                  src={rkWoodLogo}
                  alt="RK WOOD INDUSTRIES"
                  style={{ height: '76px', width: 'auto', objectFit: 'contain', display: 'block' }}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 900, letterSpacing: '1px', color: '#1E1B4B', textTransform: 'uppercase', margin: '0 0 2px 0', lineHeight: '1.1' }}>
                  R.K. WOOD INDUSTRIES
                </h1>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.8px', color: '#4338CA', textTransform: 'uppercase', marginBottom: '2px' }}>
                  MFG. OF QUALITY WOODEN BOXES, PALLETS & TIMBER MERCHANTS
                </div>
                <p style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600, margin: '1px 0', lineHeight: '1.3' }}>
                  5181 1, NR. PANCHAYAT QTRS, NAVI NAGRI, GEB ROAD, ANKLESHWAR-393001
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E1B4B', background: '#EEF2FF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #C7D2FE' }}>
                    GSTIN: 24AJBPP3261G1ZH
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                    MO. 9879810196 / 9377510359
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '3px' }}>
                <div style={{ background: '#1E1B4B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.88rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '4px', textAlign: 'center' }}>
                  PAYMENT RECEIPT
                </div>
                <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4338CA' }}>
                  {activePdfReceipt.bill_no}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #1E1B4B', borderBottom: '1px solid #1E1B4B', padding: '1px 0', margin: '4px 0 10px 0' }} />

            {/* Meta Bar */}
            <div style={{ border: '1.5px solid #1E1B4B', borderRadius: '4px', padding: '8px 12px', background: '#FAF5FF', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>CUSTOMER NAME:</span>
                <strong style={{ fontSize: '0.94rem', color: '#1E1B4B', textTransform: 'uppercase' }}>
                  {activePdfReceipt.customer_name || '________________________'}
                </strong>
                {activePdfReceipt.customer_phone && (
                  <span style={{ fontSize: '0.76rem', color: '#475569', display: 'block' }}>
                    Phone: {activePdfReceipt.customer_phone}
                  </span>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>DATE:</span>
                <strong className="font-mono" style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                  {activePdfReceipt.order_date}
                </strong>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', display: 'block', textTransform: 'uppercase' }}>STATUS:</span>
                <span 
                  style={{ 
                    fontSize: '0.82rem', 
                    fontWeight: 800, 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    display: 'inline-block',
                    ...getStatusBadgeStyle(activePdfReceipt.payment_status || 'Paid')
                  }}
                >
                  {activePdfReceipt.payment_status || 'Paid'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <table className="invoice-grid-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', border: '1.5px solid #1E1B4B', marginBottom: '10px' }}>
              <thead>
                <tr style={{ background: '#1E1B4B', color: '#FFFFFF', borderBottom: '1.5px solid #1E1B4B' }}>
                  <th style={{ width: '38px', padding: '7px 4px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>#</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Category / Item</th>
                  <th style={{ width: '120px', padding: '7px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Size (W" × T")</th>
                  <th style={{ width: '90px', padding: '7px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Length (Ft)</th>
                  <th style={{ width: '60px', padding: '7px 4px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Pcs</th>
                  <th style={{ width: '95px', padding: '7px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Volume (CFT)</th>
                  <th style={{ width: '100px', padding: '7px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Rate / CFT</th>
                  <th style={{ width: '115px', padding: '7px 8px', textAlign: 'right', fontWeight: 800 }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(activePdfReceipt.items || []).map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #CBD5E1' }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, padding: '5px 4px', borderRight: '1px solid #CBD5E1' }}>{idx + 1}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 700, borderRight: '1px solid #CBD5E1', color: '#1E1B4B' }}>{it.wood_type || it.description}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #CBD5E1', fontFamily: 'var(--font-mono)' }}>
                      {it.width_in || '—'}" × {it.thickness_in || '—'}"
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #CBD5E1', fontFamily: 'var(--font-mono)' }}>
                      {it.length_ft || '—'} ft
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #CBD5E1', fontWeight: 800, color: '#1E1B4B' }}>
                      {it.pcs}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #CBD5E1', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)' }}>
                      {parseFloat(it.total_cft || 0).toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #CBD5E1', fontFamily: 'var(--font-mono)' }}>
                      ₹{it.rate_per_cft || it.rate || 0}
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#047857' }}>
                      ₹{parseFloat(it.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ border: '1.5px solid #1E1B4B', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr' }}>
                <div style={{ padding: '8px 12px', borderRight: '1.5px solid #1E1B4B', background: '#F8FAFC', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E1B4B', marginBottom: '3px' }}>
                      Total Volume: <span style={{ color: '#B45309' }}>{parseFloat(activePdfReceipt.total_cft || 0).toFixed(3)} CFT</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600, textTransform: 'capitalize' }}>
                      Amount in words: <em>{numberToWordsIndian(parseFloat(activePdfReceipt.grand_total || 0))}</em>
                    </div>
                  </div>

                  {activePdfReceipt.notes && (
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '6px' }}>
                      <strong>Note:</strong> {activePdfReceipt.notes}
                    </div>
                  )}
                </div>

                <div style={{ padding: '8px 12px', background: '#FFFFFF', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#475569' }}>
                    <span>Wood Subtotal:</span>
                    <span className="font-mono font-semibold">₹{parseFloat(activePdfReceipt.subtotal || activePdfReceipt.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>

                  {parseFloat(activePdfReceipt.cutting_charges || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#475569' }}>
                      <span>Cutting Charges:</span>
                      <span className="font-mono">+₹{parseFloat(activePdfReceipt.cutting_charges).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {parseFloat(activePdfReceipt.transport_charges || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#475569' }}>
                      <span>Transport / Loading:</span>
                      <span className="font-mono">+₹{parseFloat(activePdfReceipt.transport_charges).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {parseFloat(activePdfReceipt.discount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#DC2626' }}>
                      <span>Discount:</span>
                      <span className="font-mono">-₹{parseFloat(activePdfReceipt.discount).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #1E1B4B', paddingTop: '4px', marginTop: '4px', fontWeight: 900, fontSize: '0.98rem', color: '#1E1B4B' }}>
                    <span>GRAND TOTAL:</span>
                    <span className="font-mono">₹{parseFloat(activePdfReceipt.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1' }}>
              <div style={{ textAlign: 'center', width: '180px' }}>
                <div style={{ borderTop: '1px solid #94A3B8', paddingTop: '3px', fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                  Customer Signature
                </div>
              </div>

              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #94A3B8', paddingTop: '3px', fontSize: '0.74rem', fontWeight: 800, color: '#1E1B4B' }}>
                  For, R.K WOOD INDUSTRIES
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
