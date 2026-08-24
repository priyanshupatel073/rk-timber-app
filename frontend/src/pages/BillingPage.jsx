import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Save,
  Plus,
  Trash2,
  Calculator,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  Tag,
  Eye,
  Edit3,
  FileText,
  Clock,
  Check,
  Download,
  FileDown,
  Share2,
  Search,
  Filter,
  X
} from 'lucide-react';
import { numberToWordsIndian } from '../utils/numberToWords';
import CftCalculatorModal from '../components/CftCalculatorModal';
import apiService from '../config/api';
import { generateInvoicePdf, downloadBlob } from '../utils/pdfGenerator';
import rkWoodLogo from '../assets/rk_wood_logo.png';

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

// Helper to format date for clean A4 print
const formatPrintDate = (dStr) => {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

// Helper to auto-increment invoice number sequentially
export const getNextInvoiceNo = (val) => {
  if (!val) return '101';
  const str = String(val).trim();
  // Match prefix, numeric sequence, and suffix (e.g. "101", "INV-101", "RK/005")
  const match = str.match(/^(.*?)(\d+)([^\d]*)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];
    const nextNum = parseInt(numStr, 10) + 1;
    const padded = String(nextNum).padStart(numStr.length, '0');
    return `${prefix}${padded}${suffix}`;
  }
  return `${str}-1`;
};

export default function BillingPage({ woodTypes = [], onOpenRates }) {
  // Company Info (matching invoice template)
  const [companyName, setCompanyName] = useState('R.K. WOOD INDUSTRIES');
  const [companyAddress, setCompanyAddress] = useState('5181 1,NR.PANCHAYA qtrs.. NAVI NAGRI GEB ROAD,ANKLESHWAR-393001 MO.9879810196/9377510359');
  const [companyGstin, setCompanyGstin] = useState('24AJBPP3261G1ZH');

  // Edit Mode tracking
  const [editingOrderId, setEditingOrderId] = useState(null); // null = New Bill, number = Editing existing

  // Invoice & Customer Meta with sequential continuation
  const [invoiceNo, setInvoiceNo] = useState(() => {
    try {
      const saved = localStorage.getItem('rk_timber_last_invoice_no');
      if (saved) return saved;
      const raw = localStorage.getItem('rk_timber_saved_invoices');
      const list = raw ? JSON.parse(raw) : [];
      if (list && list.length > 0) {
        const topBill = (list[0].bill_no || '').replace(/^INV-/, '');
        return getNextInvoiceNo(topBill);
      }
    } catch (e) { }
    return '101';
  });
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // GST Configuration & Checkbox Toggle (Unticked by default)
  const [isGstEnabled, setIsGstEnabled] = useState(false);
  const [gstRatePercent, setGstRatePercent] = useState(5); // 5% total (2.5% CGST + 2.5% SGST)

  // Helper to create blank editable item rows
  const createInitialRows = (count = 6) => Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    description: '',
    hsn_code: '',
    qty: '',
    unit: 'Nos',
    rate: '',
  }));

  // Invoice Items initialized with 6 fully enabled rows
  const [items, setItems] = useState(() => createInitialRows(6));

  // Canvas Ref for PDF generation
  const invoiceCanvasRef = useRef(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper functions for persistent storage
  const getStoredInvoices = () => {
    try {
      const raw = localStorage.getItem('rk_timber_saved_invoices');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveStoredInvoices = (invoices) => {
    try {
      localStorage.setItem('rk_timber_saved_invoices', JSON.stringify(invoices));
    } catch (e) {
      console.warn("Failed to persist invoices to localStorage", e);
    }
  };

  // Saved Invoices History list initialized directly from storage
  const [savedOrders, setSavedOrders] = useState(() => getStoredInvoices());
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search & Month Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Filtered Invoices based on search query & monthly filter
  const filteredOrders = savedOrders.filter(ord => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (ord.bill_no && ord.bill_no.toLowerCase().includes(q)) ||
      (ord.customer_name && ord.customer_name.toLowerCase().includes(q)) ||
      (ord.customer_phone && ord.customer_phone.toLowerCase().includes(q)) ||
      (ord.vehicle_no && ord.vehicle_no.toLowerCase().includes(q)) ||
      (ord.customer_address && ord.customer_address.toLowerCase().includes(q))
    );

    let matchesMonth = true;
    if (monthFilter) {
      const ordDate = ord.order_date || ord.created_at || '';
      matchesMonth = isDateInMonth(ordDate, monthFilter);
    }

    return matchesSearch && matchesMonth;
  });

  // UI helpers
  const [isCftModalOpen, setIsCftModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Fetch saved orders on mount (merging MySQL with Local Storage and auto-syncing)
  useEffect(() => {
    fetchSavedOrders();
  }, []);

  const fetchSavedOrders = async () => {
    setLoadingHistory(true);
    const localInvoices = getStoredInvoices();
    if (localInvoices.length > 0) {
      setSavedOrders(localInvoices);
    }
    try {
      const allDbData = await apiService.getOrders();
      if (Array.isArray(allDbData)) {
        // Filter strictly Timber Billing Tax Invoices (exclude Quick Receipts RCP-)
        const dbData = allDbData.filter(o => !o.bill_no || !o.bill_no.startsWith('RCP-'));
        const dbBillNos = new Set(dbData.map(o => o.bill_no));

        // Auto-sync any local-only invoices directly into MySQL
        for (const loc of localInvoices) {
          if (!loc.bill_no?.startsWith('RCP-') && !dbBillNos.has(loc.bill_no)) {
            try {
              const syncPayload = { ...loc, id: null };
              const syncRes = await apiService.saveOrder(syncPayload);
              if (syncRes && syncRes.success && syncRes.data) {
                dbData.push(syncRes.data);
                dbBillNos.add(syncRes.data.bill_no);
              }
            } catch (syncErr) {
              console.warn("Auto-sync invoice to DB failed:", syncErr);
            }
          }
        }

        dbData.sort((a, b) => (new Date(b.order_date || b.created_at || 0)) - (new Date(a.order_date || a.created_at || 0)));
        setSavedOrders(dbData);
        saveStoredInvoices(dbData);
      } else if (localInvoices.length > 0) {
        setSavedOrders(localInvoices);
      }
    } catch (e) {
      console.warn("API fetch fallback to local storage:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Row Manipulation
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now() + Math.random(),
        description: '',
        hsn_code: '',
        qty: '',
        unit: 'Nos',
        rate: '',
      }
    ]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const handleDeleteItem = (id) => {
    if (items.length <= 1) {
      setItems(createInitialRows(1));
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  const handleInsertCftItem = (calculatedData) => {
    const active = items.filter(it => (it.description && it.description.trim()) || it.qty || it.rate);
    const newItem = {
      id: Date.now(),
      description: calculatedData.description,
      hsn_code: calculatedData.hsn_code || '',
      qty: calculatedData.qty,
      unit: calculatedData.unit || 'CFT',
      rate: calculatedData.rate,
    };
    const combined = [...active, newItem];
    while (combined.length < 6) {
      combined.push({
        id: Date.now() + combined.length,
        description: '',
        hsn_code: '',
        qty: '',
        unit: 'Nos',
        rate: ''
      });
    }
    setItems(combined);
  };

  const handleResetInvoice = () => {
    setEditingOrderId(null);
    const nextNo = localStorage.getItem('rk_timber_last_invoice_no') || getNextInvoiceNo(invoiceNo);
    setInvoiceNo(nextNo);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerAddress('');
    setVehicleNo('');
    setCustomerGstin('');
    setCustomerPhone('');
    setIsGstEnabled(false);
    setGstRatePercent(5);
    setItems(createInitialRows(6));
    setSaveSuccessMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load Order for Viewing or Editing
  const handleLoadOrder = async (orderId, mode = 'view') => {
    try {
      const localList = getStoredInvoices();
      let order = localList.find(o => o.id === orderId || o.bill_no === orderId || String(o.id) === String(orderId));

      // Always fetch fresh from API if order has no items or was fetched from basic list
      if (!order || !order.items || order.items.length === 0) {
        try {
          const fetched = await apiService.getOrderById(orderId);
          if (fetched) {
            order = fetched;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch order by ID:", fetchErr);
        }
      }

      if (order) {
        setEditingOrderId(order.id);
        const cleanBillNo = (order.bill_no || '').replace(/^INV-/, '').replace(/^RK-/, '');
        setInvoiceNo(cleanBillNo || `${order.id}`);
        setInvoiceDate(order.order_date ? order.order_date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setCustomerName(order.customer_name || '');
        setCustomerPhone(order.customer_phone || '');

        // Parse address and vehicle if combined
        const fullAddr = order.customer_address || '';
        const vehicleMatch = fullAddr.match(/\(Vehicle:\s*([^)]+)\)/i);
        if (vehicleMatch) {
          setVehicleNo(vehicleMatch[1].trim());
          setCustomerAddress(fullAddr.replace(/\(Vehicle:\s*[^)]+\)/i, '').trim());
        } else if (order.vehicle_no) {
          setVehicleNo(order.vehicle_no);
          setCustomerAddress(fullAddr);
        } else {
          setVehicleNo('');
          setCustomerAddress(fullAddr);
        }

        // Parse GST settings
        const taxP = parseFloat(order.tax_percent) || 0;
        if (taxP > 0) {
          setIsGstEnabled(true);
          setGstRatePercent(taxP);
        } else {
          setIsGstEnabled(false);
          setGstRatePercent(5);
        }

        // Parse GSTIN from notes
        if (order.notes && order.notes.includes('GSTIN:')) {
          const match = order.notes.match(/GSTIN:\s*([^,]+)/i);
          if (match && match[1].trim() !== 'N/A') {
            setCustomerGstin(match[1].trim());
          }
        }

        // Load item rows
        let rawItems = order.items;
        if (typeof rawItems === 'string') {
          try {
            rawItems = JSON.parse(rawItems);
          } catch (e) { }
        }

        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const loaded = rawItems.map((it, idx) => {
            const description = it.description || it.wood_type || '';
            const hsn_code = it.hsn_code || '';
            const qty = it.qty !== undefined && it.qty !== '' ? it.qty : (it.pcs !== undefined ? it.pcs : '');
            const unit = it.unit || 'Nos';
            const rate = it.rate !== undefined && it.rate !== '' ? it.rate : (it.rate_per_cft !== undefined ? it.rate_per_cft : (it.total_amount && it.pcs ? (it.total_amount / it.pcs) : ''));
            return {
              id: it.id || Date.now() + idx,
              description,
              hsn_code,
              qty,
              unit,
              rate
            };
          });

          while (loaded.length < 6) {
            loaded.push({
              id: Date.now() + loaded.length,
              description: '',
              hsn_code: '',
              qty: '',
              unit: 'Nos',
              rate: ''
            });
          }
          setItems(loaded);
        } else {
          setItems(createInitialRows(6));
        }

        setSaveSuccessMsg(mode === 'edit' ? `Loaded Invoice #${cleanBillNo || order.id} for Editing` : `Loaded Invoice #${cleanBillNo || order.id} for View & Print!`);
        setTimeout(() => setSaveSuccessMsg(''), 3000);

        // Smooth scroll to top invoice canvas
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      alert("Failed to load invoice details: " + e.message);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId, billNo) => {
    if (window.confirm(`Are you sure you want to permanently delete invoice ${billNo}?`)) {
      const localList = getStoredInvoices().filter(o => o.id !== orderId && o.bill_no !== billNo && String(o.id) !== String(orderId));
      saveStoredInvoices(localList);
      setSavedOrders(localList);

      if (editingOrderId === orderId) {
        handleResetInvoice();
      }
      setSaveSuccessMsg(`Invoice ${billNo} deleted successfully.`);
      setTimeout(() => setSaveSuccessMsg(''), 3000);

      try {
        await apiService.deleteOrder(orderId);
      } catch (err) {
        console.warn("Delete order backend sync:", err);
      }
    }
  };

  // Calculations
  let subtotal = 0;
  const calculatedItems = items.map((item, idx) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const balance = qty * rate;
    subtotal += balance;
    const hasContent = Boolean((item.description && item.description.trim()) || qty > 0 || rate > 0);
    return {
      ...item,
      sno: idx + 1,
      balance,
      hasContent
    };
  });

  const totalGstRate = isGstEnabled ? (parseFloat(gstRatePercent) || 0) : 0;
  const cgstRate = totalGstRate / 2;
  const sgstRate = totalGstRate / 2;

  const cgstAmount = isGstEnabled ? (subtotal * cgstRate) / 100 : 0;
  const sgstAmount = isGstEnabled ? (subtotal * sgstRate) / 100 : 0;
  const grandTotal = isGstEnabled ? (subtotal + cgstAmount + sgstAmount) : subtotal;

  const amountInWords = numberToWordsIndian(grandTotal);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Save to Database & Local Records
  const handleSaveToDatabase = async () => {
    if (!customerName.trim()) {
      alert("Please enter Customer Name before saving invoice.");
      return;
    }

    setIsSaving(true);
    const orderBillNo = `INV-${invoiceNo}`;
    const currentId = editingOrderId || Date.now();

    const validItems = items.filter(it => (it.description && it.description.trim()) || (parseFloat(it.qty) || 0) > 0 || (parseFloat(it.rate) || 0) > 0);
    const itemsToSave = validItems.length > 0 ? validItems : [items[0]];

    const invoiceRecord = {
      id: currentId,
      bill_no: orderBillNo,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_address: `${customerAddress}${vehicleNo ? ` (Vehicle: ${vehicleNo})` : ''}`,
      vehicle_no: vehicleNo.trim(),
      order_date: invoiceDate,
      items: itemsToSave.map((it, idx) => ({
        id: it.id || Date.now() + idx,
        wood_type: it.description || 'Wood Item',
        description: it.description || 'Wood Item',
        hsn_code: it.hsn_code || '',
        qty: it.qty || 1,
        pcs: parseFloat(it.qty) || 1,
        rate: it.rate || 0,
        rate_per_cft: parseFloat(it.rate) || 0,
        unit: it.unit || 'Nos',
        length_ft: 1,
        width_in: 1,
        thickness_in: 144
      })),
      total_cft: 0,
      subtotal: subtotal,
      cutting_charges: 0,
      transport_charges: 0,
      tax_percent: totalGstRate,
      discount: 0,
      grand_total: grandTotal,
      notes: `GSTIN: ${customerGstin || 'N/A'}, Vehicle: ${vehicleNo || 'N/A'}, CGST: ₹${cgstAmount.toFixed(2)}, SGST: ₹${sgstAmount.toFixed(2)}`,
      payment_status: 'Paid',
      created_at: new Date().toISOString()
    };

    // 1. Immediately store to LocalStorage and update state so it shows in the table right away
    const currentList = getStoredInvoices();
    const existingIdx = currentList.findIndex(o => o.id === currentId || o.bill_no === orderBillNo || String(o.id) === String(currentId));
    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...currentList];
      updatedList[existingIdx] = invoiceRecord;
    } else {
      updatedList = [invoiceRecord, ...currentList];
    }

    // Persist next sequential number for future new bills
    const nextSequentialNo = getNextInvoiceNo(invoiceNo);
    localStorage.setItem('rk_timber_last_invoice_no', nextSequentialNo);

    saveStoredInvoices(updatedList);
    setSavedOrders(updatedList);
    setEditingOrderId(currentId);
    setSaveSuccessMsg(`Invoice #${invoiceNo} saved successfully!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);

    // 2. Sync with MySQL database in the background
    try {
      const payload = {
        ...invoiceRecord,
        id: (typeof editingOrderId === 'number' && editingOrderId < 10000000000) ? editingOrderId : null
      };
      const res = await apiService.saveOrder(payload);
      if (res && res.success && res.data && res.data.id) {
        const finalId = res.data.id;
        setEditingOrderId(finalId);
        const syncedList = updatedList.map(o => o.bill_no === orderBillNo ? { ...o, id: finalId } : o);
        saveStoredInvoices(syncedList);
        setSavedOrders(syncedList);
      }
    } catch (err) {
      console.log("Database sync offline, invoice securely saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  // Download A4 PDF for active canvas
  const handleDownloadPdf = async (customFilename) => {
    if (!invoiceCanvasRef.current) return;
    const cleanNo = (invoiceNo || '').replace(/^INV-/, '').replace(/^RK-/, '');
    const filename = customFilename || `Invoice_${cleanNo}_${(customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    try {
      setIsGeneratingPdf(true);
      await new Promise(r => setTimeout(r, 300));
      const { blob } = await generateInvoicePdf(invoiceCanvasRef.current, filename);
      downloadBlob(blob, filename);
      setSaveSuccessMsg(`PDF "${filename}" downloaded successfully!`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      return { blob, filename };
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Download PDF for a specific saved order from table
  const handleDownloadPdfForOrder = async (ord) => {
    try {
      setIsGeneratingPdf(true);
      if (ord.id !== editingOrderId) {
        await handleLoadOrder(ord.id, 'view');
        await new Promise(r => setTimeout(r, 450));
      } else {
        await new Promise(r => setTimeout(r, 200));
      }

      const billNum = (ord.bill_no || '').replace(/^INV-/, '').replace(/^RK-/, '');
      const custName = ord.customer_name || 'Customer';
      const filename = `Invoice_${billNum}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      if (invoiceCanvasRef.current) {
        const { blob } = await generateInvoicePdf(invoiceCanvasRef.current, filename);
        downloadBlob(blob, filename);
        setSaveSuccessMsg(`PDF "${filename}" downloaded successfully!`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // WhatsApp Share as PDF Document (Strict PDF file attachment)
  const handleWhatsAppPdfShare = async (targetOrder = null) => {
    try {
      setIsGeneratingPdf(true);

      // If a specific order from table was clicked, load it into canvas first
      if (targetOrder && targetOrder.id !== editingOrderId) {
        await handleLoadOrder(targetOrder.id, 'view');
        await new Promise(r => setTimeout(r, 450));
      } else {
        await new Promise(r => setTimeout(r, 250));
      }

      const billNum = targetOrder ? (targetOrder.bill_no || '').replace(/^INV-/, '').replace(/^RK-/, '') : (invoiceNo || '').replace(/^INV-/, '').replace(/^RK-/, '');
      const custName = targetOrder ? (targetOrder.customer_name || 'Valued Customer') : (customerName || 'Valued Customer');
      const phoneNum = targetOrder ? targetOrder.customer_phone : customerPhone;
      const filename = `Invoice_${billNum}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      if (!invoiceCanvasRef.current) {
        throw new Error('Invoice canvas element not found');
      }

      // Generate the exact A4 PDF from the canvas
      const { blob } = await generateInvoicePdf(invoiceCanvasRef.current, filename);
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // 1. Mobile & Web Share API (Android / iOS): Shares the ACTUAL PDF file directly into WhatsApp!
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: filename
          });
          setSaveSuccessMsg(`PDF Invoice #${billNum} shared directly to WhatsApp!`);
          setTimeout(() => setSaveSuccessMsg(''), 4000);
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // 2. Desktop Fallback (PC / Mac):
      // Download the PDF file directly to user's computer
      downloadBlob(blob, filename);

      // Open WhatsApp chat directly with clean chat window (no text or localhost URLs)
      const cleanPhone = (phoneNum || '').replace(/\D/g, '');
      const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : '';
      const url = phoneParam ? `https://wa.me/${phoneParam}` : `https://web.whatsapp.com/`;
      
      window.open(url, '_blank');

      setSaveSuccessMsg(`PDF "${filename}" downloaded to your computer! Attach it in WhatsApp.`);
      setTimeout(() => setSaveSuccessMsg(''), 6000);
    } catch (err) {
      console.error('PDF WhatsApp Share error:', err);
      alert('Error generating PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="page-wrapper fade-in" style={{ paddingBottom: '60px' }}>
      {/* Active Edit/View Mode Banner */}
      {editingOrderId && (
        <div className="no-print active-loaded-invoice-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} className="text-amber" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                Loaded Bill #{invoiceNo}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {customerName || 'Customer'} {vehicleNo ? `• ${vehicleNo}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleWhatsAppPdfShare(null)}
              disabled={isGeneratingPdf}
              style={{ background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', fontWeight: 700, padding: '5px 12px', fontSize: '0.8rem' }}
              title="Share this active bill on WhatsApp"
            >
              <MessageSquare size={13} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetInvoice}
              style={{ fontWeight: 700, padding: '5px 12px', fontSize: '0.8rem', background: '#FFFFFF' }}
            >
              <Plus size={13} />
              <span>+ New</span>
            </button>
          </div>
        </div>
      )}

      {/* Top GST Controller & Actions Toolbar */}
      <div className="billing-top-toolbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* GST Toggle with Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, color: isGstEnabled ? '#047857' : '#64748B' }}>
              <input
                type="checkbox"
                checked={isGstEnabled}
                onChange={e => setIsGstEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#D97706' }}
              />
              <span>{isGstEnabled ? 'GST Applied' : 'No GST (Exempt)'}</span>
            </label>

            {isGstEnabled && (
              <select
                className="input-field font-mono"
                style={{ padding: '4px 8px', fontSize: '0.85rem', fontWeight: 800, width: 'auto', background: '#FFFFFF', marginLeft: '4px' }}
                value={gstRatePercent}
                onChange={e => setGstRatePercent(parseFloat(e.target.value))}
              >
                <option value="5">5% (2.5% CGST + 2.5% SGST)</option>
                <option value="12">12% (6% CGST + 6% SGST)</option>
                <option value="18">18% (9% CGST + 9% SGST)</option>
                <option value="28">28% (14% CGST + 14% SGST)</option>
              </select>
            )}
          </div>

          {/* Generate New Bill Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetInvoice}
            style={{ fontWeight: 800, background: '#FFFFFF', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1.5px solid #CBD5E1', color: '#1E1B4B' }}
          >
            <Plus size={15} />
            <span>Generate New Bill</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="no-print" style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#047857',
          padding: '10px 16px',
          borderRadius: '10px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* =========================================================================
          EXACT PDF INVOICE PAPER CANVAS (STANDARDIZED TO A4 PROPORTIONS)
          ========================================================================= */}
      <div
        ref={invoiceCanvasRef}
        className="invoice-paper-canvas"
        style={{
          background: '#FFFFFF',
          width: '100%',
          maxWidth: '850px',
          minHeight: '1080px',
          margin: '0 auto',
          padding: '32px 38px',
          borderRadius: '4px',
          border: '1px solid #CBD5E1',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          color: '#000000',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          boxSizing: 'border-box'
        }}
      >
        {/* TOP SECTION: Header, Title & Meta */}
        <div className="invoice-top-section">
          {/* 1. Header Section with Logo & Brand Details */}
          <div className="invoice-header-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '14px', alignItems: 'center', marginBottom: '8px' }}>
            {/* Left: Official RK Wood Logo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
              <img
                src={rkWoodLogo}
                alt="RK WOOD INDUSTRIES"
                style={{ height: '84px', width: 'auto', objectFit: 'contain', display: 'block', maxWidth: '120px' }}
              />
            </div>

            {/* Center: Company Name & Contact Info */}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: '1.85rem',
                fontWeight: 900,
                letterSpacing: '1px',
                color: '#1E1B4B',
                textTransform: 'uppercase',
                margin: '0 0 2px 0',
                lineHeight: '1.1'
              }}>
                {companyName}
              </h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.8px', color: '#4338CA', textTransform: 'uppercase', marginBottom: '2px' }}>
                MFG. OF QUALITY WOODEN BOXES, PALLETS & TIMBER MERCHANTS
              </div>
              <p style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 600, margin: '1px 0', lineHeight: '1.3' }}>
                {companyAddress}
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1E1B4B', background: '#EEF2FF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #C7D2FE' }}>
                  GSTIN: {companyGstin}
                </span>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  STATE CODE: 24 (GUJARAT)
                </span>
              </div>
            </div>

            {/* Right: Invoice Type Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
              <div style={{
                background: '#1E1B4B',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.95rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '5px 12px',
                borderRadius: '4px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(30, 27, 75, 0.15)'
              }}>
                TAX INVOICE
              </div>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ORIGINAL FOR RECIPIENT
              </span>
            </div>
          </div>

          {/* 2. Top Double Divider */}
          <div style={{ borderTop: '2.5px solid #1E1B4B', borderBottom: '1px solid #1E1B4B', padding: '1px 0', margin: '4px 0 10px 0' }} />

          {/* 3. Invoice & Customer Meta Grid (2 Partitioned Boxes) */}
          <div className="invoice-meta-wrapper" style={{ border: '1.5px solid #1E1B4B', marginBottom: '10px', borderRadius: '2px', overflow: 'hidden' }}>
            <div className="invoice-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', margin: 0, gap: 0 }}>
              {/* Left Box: Invoice Meta */}
              <div className="invoice-meta-box invoice-meta-left" style={{ padding: '8px 12px', borderRight: '1.5px solid #1E1B4B', background: '#FAF5FF', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4338CA', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #E9D5FF', paddingBottom: '3px', marginBottom: '2px' }}>
                  INVOICE DETAILS
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '105px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}>INVOICE NO:</span>
                  <input
                    type="text"
                    className="invoice-clean-input font-mono screen-only"
                    style={{ fontWeight: 800, fontSize: '0.92rem', width: '130px', color: '#1E1B4B' }}
                    value={invoiceNo}
                    onChange={e => {
                      const val = e.target.value;
                      setInvoiceNo(val);
                      const nextVal = getNextInvoiceNo(val);
                      localStorage.setItem('rk_timber_last_invoice_no', nextVal);
                    }}
                    placeholder="101"
                  />
                  <span className="print-only font-mono" style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1E1B4B' }}>
                    {invoiceNo || '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '105px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}>DATE:</span>
                  <input
                    type="date"
                    className="invoice-clean-input font-mono screen-only"
                    style={{ fontWeight: 700, fontSize: '0.88rem', width: '150px' }}
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                  />
                  <span className="print-only font-mono" style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    {formatPrintDate(invoiceDate)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '105px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}>GSTIN:</span>
                  <input
                    type="text"
                    className="invoice-clean-input font-mono screen-only"
                    style={{ fontWeight: 600, fontSize: '0.86rem', flex: 1 }}
                    value={customerGstin}
                    onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
                    placeholder="24BTVPK1489A1ZJ"
                  />
                  <span className="print-only font-mono" style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                    {customerGstin || '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }} className="no-print">
                  <span style={{ width: '105px', fontWeight: 700, color: '#64748B', fontSize: '0.82rem' }}>PHONE (WA):</span>
                  <input
                    type="tel"
                    className="invoice-clean-input"
                    style={{ fontSize: '0.85rem', flex: 1 }}
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Mobile for WhatsApp"
                  />
                </div>
              </div>

              {/* Right Box: Customer Info & Vehicle No */}
              <div className="invoice-meta-box invoice-meta-right" style={{ padding: '8px 12px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1E1B4B', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', marginBottom: '2px' }}>
                  BILLED TO (CUSTOMER DETAILS)
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '95px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}>CUSTOMER:</span>
                  <input
                    type="text"
                    className="invoice-clean-input screen-only"
                    style={{ fontWeight: 800, fontSize: '0.92rem', flex: 1, textTransform: 'uppercase', color: '#0F172A' }}
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="SWASTIK ENTERPRISE"
                    required
                  />
                  <span className="print-only" style={{ fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', color: '#0F172A' }}>
                    {customerName || '________________________'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{ width: '95px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem', paddingTop: '2px' }}>ADDRESS:</span>
                  <textarea
                    rows={2}
                    className="invoice-clean-input screen-only"
                    style={{
                      fontWeight: 600,
                      fontSize: '0.86rem',
                      flex: 1,
                      textTransform: 'uppercase',
                      resize: 'none',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.35',
                      padding: '2px 4px'
                    }}
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                    placeholder="ANKLESHWAR"
                  />
                  <div className="print-only" style={{
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    flex: 1,
                    textTransform: 'uppercase',
                    lineHeight: '1.35',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {customerAddress || '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '95px', fontWeight: 800, color: '#1E1B4B', fontSize: '0.84rem' }}>VEHICLE NO:</span>
                  <input
                    type="text"
                    className="invoice-clean-input font-mono screen-only"
                    style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1, textTransform: 'uppercase' }}
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                    placeholder="GJ-16-AB-1234"
                  />
                  <span className="print-only font-mono" style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase' }}>
                    {vehicleNo || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: Main Invoice Items Table */}
        <div className="mobile-table-swipe-hint no-print" data-html2canvas-ignore="true">
          <span>↔ Swipe table to view all columns</span>
          <span style={{ fontWeight: 700, color: '#4338CA' }}>6 Columns</span>
        </div>
        <div className="invoice-table-section invoice-table-responsive" style={{ border: '1.5px solid #1E1B4B', marginBottom: '0px' }}>
          <table className="invoice-grid-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#1E1B4B', color: '#FFFFFF', borderBottom: '1.5px solid #1E1B4B' }}>
                <th style={{ width: '45px', padding: '8px 4px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>S.NO</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #4338CA' }}>DESCRIPTION</th>
                <th style={{ width: '85px', padding: '8px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>HSN CODE</th>
                <th style={{ width: '90px', padding: '8px 4px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      id="gstColToggle"
                      className="no-print"
                      checked={isGstEnabled}
                      onChange={e => setIsGstEnabled(e.target.checked)}
                      style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#4338CA' }}
                      title="Toggle GST On / Off"
                    />
                    <label htmlFor="gstColToggle" style={{ cursor: 'pointer' }}>GST RATE</label>
                  </div>
                </th>
                <th style={{ width: '95px', padding: '8px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>QTY</th>
                <th style={{ width: '90px', padding: '8px 6px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #4338CA' }}>RATE</th>
                <th style={{ width: '110px', padding: '8px 8px', textAlign: 'right', fontWeight: 800, borderRight: '1px solid #4338CA' }}>Balance</th>
                <th className="no-print" data-html2canvas-ignore="true" style={{ width: '34px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {calculatedItems.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #CBD5E1', minHeight: '38px' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, padding: '6px 4px', borderRight: '1px solid #CBD5E1' }}>
                    <span className="screen-only">{idx + 1}</span>
                    <span className="print-only">{item.hasContent ? idx + 1 : ''}</span>
                  </td>

                  <td style={{ padding: '6px 8px', borderRight: '1px solid #CBD5E1' }}>
                    <textarea
                      rows={item.description && item.description.includes('\n') ? 2 : 1}
                      className="invoice-cell-textarea screen-only"
                      placeholder={idx === 0 ? "Item name & specifications (e.g. Wooden Pallets 950x950)" : "Item description / Wood item"}
                      value={item.description}
                      onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', fontWeight: 600, fontSize: '0.85rem', lineHeight: '1.3' }}
                    />
                    <div className="print-only" style={{ width: '100%', fontWeight: 600, fontSize: '0.85rem', lineHeight: '1.3', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {item.hasContent ? (item.description || 'Wood Item') : ''}
                    </div>
                  </td>

                  <td style={{ textAlign: 'center', padding: '4px 4px', borderRight: '1px solid #CBD5E1' }}>
                    <input
                      type="text"
                      className="invoice-cell-input font-mono screen-only"
                      style={{ textAlign: 'center', width: '100%', border: 'none', background: 'transparent', fontWeight: 600 }}
                      value={item.hsn_code}
                      onChange={e => handleUpdateItem(item.id, 'hsn_code', e.target.value)}
                      placeholder=""
                    />
                    <span className="print-only font-mono" style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                      {item.hasContent ? (item.hsn_code || '') : ''}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', padding: '4px 4px', borderRight: '1px solid #CBD5E1', fontWeight: 600 }}>
                    <span className="screen-only">
                      {isGstEnabled && totalGstRate > 0 ? `${totalGstRate}%` : '0%'}
                    </span>
                    <span className="print-only">
                      {item.hasContent ? (isGstEnabled && totalGstRate > 0 ? `${totalGstRate}%` : '0%') : ''}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', padding: '4px 4px', borderRight: '1px solid #CBD5E1' }}>
                    <div className="screen-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="invoice-cell-input font-mono"
                        style={{ textAlign: 'center', width: '55px', border: 'none', background: 'transparent', fontWeight: 700 }}
                        value={item.qty}
                        onChange={e => handleUpdateItem(item.id, 'qty', e.target.value)}
                        placeholder="0"
                      />
                      <select
                        className="invoice-unit-select font-mono"
                        value={item.unit}
                        onChange={e => handleUpdateItem(item.id, 'unit', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <option value="Nos">Nos</option>
                        <option value="CFT">CFT</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Quintal">Quintal</option>
                        <option value="Qtl">Qtl</option>
                        <option value="Kg">Kg</option>
                        <option value="Ton">Ton</option>
                        <option value="Sqm">Sqm</option>
                        <option value="Sqft">Sqft</option>
                        <option value="Set">Set</option>
                      </select>
                    </div>
                    <span className="print-only font-mono" style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                      {item.hasContent && item.qty ? `${item.qty} ${item.unit}` : ''}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', padding: '4px 4px', borderRight: '1px solid #CBD5E1' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="invoice-cell-input font-mono screen-only"
                      style={{ textAlign: 'center', width: '100%', border: 'none', background: 'transparent', fontWeight: 700 }}
                      value={item.rate}
                      onChange={e => handleUpdateItem(item.id, 'rate', e.target.value)}
                      placeholder="0"
                    />
                    <span className="print-only font-mono" style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                      {item.hasContent && item.rate ? parseFloat(item.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, fontFamily: 'var(--font-mono)', borderRight: '1px solid #CBD5E1' }}>
                    <span className="screen-only">
                      {item.balance > 0 ? item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}
                    </span>
                    <span className="print-only">
                      {item.hasContent && item.balance > 0 ? item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
                    </span>
                  </td>

                  <td className="no-print" data-html2canvas-ignore="true" style={{ textAlign: 'center', padding: '2px' }}>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => handleDeleteItem(item.id)}
                        title="Remove row"
                        style={{ padding: '2px', color: '#DC2626' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* Subtotal Row */}
              <tr style={{ borderTop: '1.5px solid #1E1B4B', background: '#F8FAFC', fontWeight: 800 }}>
                <td colSpan="6" style={{ textAlign: 'right', padding: '8px 12px', borderRight: '1px solid #CBD5E1', fontSize: '0.88rem', color: '#1E1B4B' }}>
                  SUBTOTAL (₹)
                </td>
                <td style={{ textAlign: 'right', padding: '8px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.94rem', borderRight: '1px solid #CBD5E1', color: '#1E1B4B' }}>
                  {subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                <td className="no-print" data-html2canvas-ignore="true"></td>
              </tr>
            </tbody>
          </table>

          {/* Action button to add row in editing mode */}
          <div className="no-print" data-html2canvas-ignore="true" style={{ margin: '8px 0 0 0', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddItem}
              style={{ fontWeight: 600, padding: '5px 12px', fontSize: '0.82rem' }}
            >
              <Plus size={14} />
              <span>+ Add Row</span>
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: Remittance & Signatures */}
        <div className="invoice-summary-section" style={{ marginTop: '10px' }}>
          {/* 6. REMITTANCE / TAX & GRAND TOTAL SECTION */}
          <div style={{ border: '1.5px solid #1E1B4B', marginBottom: '10px', borderRadius: '2px', overflow: 'hidden' }}>
            {/* Header Bar with Checkbox */}
            <div style={{
              background: '#1E1B4B',
              color: '#FFFFFF',
              padding: '6px 12px',
              fontWeight: 800,
              fontSize: '0.82rem',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>TAX & REMITTANCE BREAKDOWN</span>
              <label className="no-print" data-html2canvas-ignore="true" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#FEF3C7' }}>
                <input
                  type="checkbox"
                  checked={isGstEnabled}
                  onChange={e => setIsGstEnabled(e.target.checked)}
                  style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#D97706' }}
                />
                <span>{isGstEnabled ? 'GST Applied' : 'GST Disabled'}</span>
              </label>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700, width: '45%', borderRight: '1px solid #CBD5E1', color: '#334155' }}>
                    CGST @ {isGstEnabled ? cgstRate : 0}%
                  </td>
                  <td style={{ padding: '6px 12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                    ₹{cgstAmount.toFixed(2)}
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700, width: '45%', borderRight: '1px solid #CBD5E1', color: '#334155' }}>
                    SGST @ {isGstEnabled ? sgstRate : 0}%
                  </td>
                  <td style={{ padding: '6px 12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                    ₹{sgstAmount.toFixed(2)}
                  </td>
                </tr>

                <tr style={{ borderTop: '1.5px solid #1E1B4B', background: '#FAF5FF' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 900, width: '45%', borderRight: '1px solid #1E1B4B', fontSize: '0.96rem', color: '#1E1B4B' }}>
                    GRAND TOTAL (ROUNDED)
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 900, fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: '#1E1B4B' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 7. Footer Meta: Amount in Words & Sign/Stamp Box */}
          <div className="invoice-footer-wrapper" style={{ border: '1.5px solid #1E1B4B', borderRadius: '2px', overflow: 'hidden' }}>
            <div className="invoice-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.3fr' }}>
              <div className="invoice-footer-box invoice-footer-left" style={{ padding: '8px 12px', borderRight: '1.5px solid #1E1B4B', background: '#F8FAFC', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4338CA', letterSpacing: '0.5px', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                    AMOUNT CHARGEABLE (IN WORDS)
                  </span>
                  <p style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E1B4B', lineHeight: 1.35, textTransform: 'capitalize' }}>
                    {amountInWords}
                  </p>
                </div>

                <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#64748B', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: 700, color: '#334155' }}>Terms & Conditions:</span> 1. Goods once sold will not be taken back. 2. Subject to Ankleshwar jurisdiction.
                </div>
              </div>

              <div className="invoice-footer-box invoice-footer-right" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '90px', background: '#FFFFFF' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  FOR, {companyName}
                </span>

                <div style={{ textAlign: 'right', fontSize: '0.74rem', fontWeight: 700, color: '#1E1B4B', borderTop: '1px dashed #CBD5E1', paddingTop: '4px' }}>
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar (Moved Below the Bill Template) */}
      <div className="billing-bottom-toolbar no-print">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleResetInvoice}
          title="Reset form and create new invoice"
          style={{ fontWeight: 700 }}
        >
          <RefreshCw size={14} />
          <span>New Invoice</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleDownloadPdf()}
          disabled={isGeneratingPdf}
          style={{ background: '#F8FAFC', color: '#1E293B', fontWeight: 600 }}
          title="Download this invoice as an A4 PDF document"
        >
          <Download size={14} />
          <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleWhatsAppPdfShare(null)}
          disabled={isGeneratingPdf}
          style={{ background: '#059669', color: '#FFF', borderColor: '#059669', fontWeight: 600 }}
          title="Share invoice in PDF format on WhatsApp"
        >
          <MessageSquare size={14} />
          <span>WhatsApp (PDF)</span>
        </button>

        <button
          type="button"
          className="btn btn-success btn-sm"
          onClick={handleSaveToDatabase}
          disabled={isSaving}
          style={{ fontWeight: 700 }}
          title="Save invoice to MySQL database"
        >
          <Save size={14} />
          <span>{isSaving ? 'Saving...' : 'Save Invoice'}</span>
        </button>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handlePrint}
          style={{ fontWeight: 700, padding: '8px 18px' }}
          title="Print exact A4 Invoice"
        >
          <Printer size={15} />
          <span>Print Invoice (A4)</span>
        </button>
      </div>

      {/* =========================================================================
          SAVED INVOICES & BILLS HISTORY LIST (BELOW INVOICE CANVAS)
          ========================================================================= */}
      <div className="saved-invoices-container no-print" style={{
        maxWidth: '1060px',
        width: '100%',
        margin: '32px auto 0 auto',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-amber" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Saved Invoices & Records ({filteredOrders.length}{filteredOrders.length !== savedOrders.length ? ` of ${savedOrders.length}` : ''})
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchSavedOrders}
            disabled={loadingHistory}
            style={{ fontWeight: 600 }}
          >
            <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
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
              placeholder="Search by customer name, phone, or bill #..."
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

        {/* 1. Desktop Table View */}
        <div className="saved-invoices-desktop-table" style={{ width: '100%', overflow: 'hidden' }}>
          <table className="custom-table" style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap', width: '85px' }}>Bill #</th>
                <th style={{ whiteSpace: 'nowrap', width: '90px' }}>Date</th>
                <th style={{ whiteSpace: 'nowrap' }}>Customer Name</th>
                <th style={{ whiteSpace: 'nowrap', width: '85px' }}>Vehicle No</th>
                <th style={{ whiteSpace: 'nowrap', width: '95px' }}>Amount (₹)</th>
                <th style={{ whiteSpace: 'nowrap', width: '70px' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    Loading saved invoices from database...
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map(ord => (
                  <tr key={ord.id} style={{ background: editingOrderId === ord.id ? '#FEF3C7' : 'transparent' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="badge-pill badge-primary font-mono" style={{ fontWeight: 800 }}>
                        {ord.bill_no}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {formatPrintDate(ord.order_date)}
                    </td>
                    <td className="font-semibold" style={{ color: '#0F172A', whiteSpace: 'nowrap' }}>
                      {ord.customer_name}
                    </td>
                    <td className="font-mono text-muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {ord.customer_address && ord.customer_address.includes('Vehicle:') ?
                        ord.customer_address.replace(/.*Vehicle:\s*([^)]+).*/i, '$1') : (ord.vehicle_no || '—')}
                    </td>
                    <td className="mono-num font-bold" style={{ color: '#047857', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
                      ₹{parseFloat(ord.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="status-tag paid" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                        <Check size={10} /> {ord.payment_status || 'Paid'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="invoice-row-actions">
                        <button
                          type="button"
                          className="row-action-btn view-btn"
                          onClick={() => handleLoadOrder(ord.id, 'view')}
                          title="View / Load Invoice"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn print-btn"
                          onClick={async () => {
                            await handleLoadOrder(ord.id, 'view');
                            setTimeout(() => {
                              window.print();
                            }, 350);
                          }}
                          title="Print A4 Invoice"
                        >
                          <Printer size={12} />
                          <span>Print</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn pdf-btn"
                          onClick={() => handleDownloadPdfForOrder(ord)}
                          disabled={isGeneratingPdf}
                          title="Download A4 PDF"
                        >
                          <FileDown size={12} />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn wa-btn"
                          onClick={() => handleWhatsAppPdfShare(ord)}
                          disabled={isGeneratingPdf}
                          title="Share on WhatsApp"
                        >
                          <MessageSquare size={12} />
                          <span>WA</span>
                        </button>

                        <button
                          type="button"
                          className="row-action-btn edit-btn"
                          onClick={() => handleLoadOrder(ord.id, 'edit')}
                          title="Edit Invoice"
                        >
                          <Edit3 size={12} />
                        </button>

                        <button
                          type="button"
                          className="row-action-btn del-btn"
                          onClick={() => handleDeleteOrder(ord.id, ord.bill_no)}
                          title="Delete Invoice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '28px', color: '#64748B' }}>
                    <p style={{ fontWeight: 600 }}>{searchQuery || monthFilter ? 'No invoices found matching your filters.' : 'No saved bills found in database yet.'}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      {searchQuery || monthFilter ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setSearchQuery(''); setMonthFilter(''); }}
                          style={{ marginTop: '6px', fontSize: '0.78rem' }}
                        >
                          Clear Filters
                        </button>
                      ) : 'Fill above invoice and click "Save Invoice" to save your first bill.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile Card List View (Visible on mobile screens) */}
        <div className="saved-invoices-mobile-cards">
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
              Loading saved invoices...
            </div>
          ) : filteredOrders.length > 0 ? (
            filteredOrders.map(ord => (
              <div
                key={ord.id}
                className={`mobile-invoice-card ${editingOrderId === ord.id ? 'active-editing' : ''}`}
              >
                <div className="mobile-invoice-card-header">
                  <span className="badge-pill badge-primary font-mono" style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    {ord.bill_no}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                    {formatPrintDate(ord.order_date)}
                  </span>
                </div>

                <div className="mobile-invoice-card-body">
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.94rem' }}>
                      {ord.customer_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                      {ord.customer_address && ord.customer_address.includes('Vehicle:') ?
                        ord.customer_address.replace(/.*Vehicle:\s*([^)]+).*/i, '$1') : (ord.vehicle_no || '—')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="mono-num font-bold" style={{ color: '#047857', fontSize: '1.05rem' }}>
                      ₹{parseFloat(ord.grand_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <span className="status-tag paid" style={{ fontSize: '0.7rem', padding: '1px 6px', marginTop: '2px' }}>
                      <Check size={9} /> {ord.payment_status || 'Paid'}
                    </span>
                  </div>
                </div>

                {/* Mobile Action Buttons: Prominent Edit & WhatsApp */}
                <div className="mobile-invoice-actions">
                  <button
                    type="button"
                    className="mobile-card-action-btn edit"
                    onClick={() => handleLoadOrder(ord.id, 'edit')}
                    title="Edit this invoice"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn wa"
                    onClick={() => handleWhatsAppPdfShare(ord)}
                    disabled={isGeneratingPdf}
                    title="Share PDF on WhatsApp"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn pdf"
                    onClick={() => handleDownloadPdfForOrder(ord)}
                    disabled={isGeneratingPdf}
                    title="Download PDF"
                  >
                    <FileDown size={13} />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn print"
                    onClick={async () => {
                      await handleLoadOrder(ord.id, 'view');
                      setTimeout(() => {
                        window.print();
                      }, 350);
                    }}
                    title="Print Invoice"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-card-action-btn del"
                    onClick={() => handleDeleteOrder(ord.id, ord.bill_no)}
                    title="Delete Record"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
              <p style={{ fontWeight: 600 }}>No saved bills found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Timber Sizing CFT Helper Modal */}
      <CftCalculatorModal
        isOpen={isCftModalOpen}
        onClose={() => setIsCftModalOpen(false)}
        onInsertIntoInvoice={handleInsertCftItem}
        woodTypes={woodTypes}
      />
    </div>
  );
}
