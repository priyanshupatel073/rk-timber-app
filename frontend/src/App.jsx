import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AddReceiptPage from './pages/AddReceiptPage';
import BillingPage from './pages/BillingPage';
import DailyRetailPage from './pages/DailyRetailPage';
import EmployeeManagementPage from './pages/EmployeeManagementPage';
import ReceiptModal from './components/ReceiptModal';
import WoodRatesModal from './components/WoodRatesModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import apiService from './config/api';

const DEFAULT_WOOD_TYPES = [
  { name: 'Teak (Sagwan)', default_rate_per_cft: 2200.00, category: 'Hardwood' },
  { name: 'Sal Wood', default_rate_per_cft: 1400.00, category: 'Hardwood' },
  { name: 'Sheesham', default_rate_per_cft: 1800.00, category: 'Hardwood' },
  { name: 'Marandi / White Cedar', default_rate_per_cft: 950.00, category: 'Softwood' },
  { name: 'Pine Wood', default_rate_per_cft: 750.00, category: 'Softwood' },
  { name: 'Plywood (Commercial)', default_rate_per_cft: 65.00, category: 'Board/Sheet' },
  { name: 'Flush Door Core', default_rate_per_cft: 850.00, category: 'Engineered Wood' }
];

const VALID_PAGES = ['dashboard', 'billing', 'add-receipt', 'daily-retail', 'employee-management'];

const getInitialPage = () => {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && VALID_PAGES.includes(hash)) {
      return hash;
    }
    const stored = localStorage.getItem('rk_timber_active_page');
    if (stored && VALID_PAGES.includes(stored)) {
      return stored;
    }
  } catch (e) {
    // fallback
  }
  return 'dashboard';
};

export default function App() {
  // Navigation State with automatic restore on page refresh
  const [activePage, setActivePage] = useState(getInitialPage);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sync activePage with localStorage and URL hash for permanent refresh survival
  useEffect(() => {
    try {
      localStorage.setItem('rk_timber_active_page', activePage);
      if (window.location.hash.replace(/^#\/?/, '') !== activePage) {
        window.location.hash = activePage;
      }
    } catch (e) { }
  }, [activePage]);

  // Handle browser back / forward navigation and external hash changes
  useEffect(() => {
    const handleHashChange = () => {
      try {
        const hash = window.location.hash.replace(/^#\/?/, '').trim();
        if (hash && VALID_PAGES.includes(hash)) {
          setActivePage(hash);
        }
      } catch (e) { }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Wood sizes state (clean initial state)
  const [items, setItems] = useState([
    { id: 1, wood_type: 'Teak (Sagwan)', length_ft: '', width_in: '', thickness_in: '', pcs: 1, rate_per_cft: 2200 }
  ]);

  // Customer & Bill Meta
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Extra Charges & Discounts
  const [cuttingCharges, setCuttingCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [notes, setNotes] = useState('');

  // App UI Controls
  const [woodTypes, setWoodTypes] = useState(DEFAULT_WOOD_TYPES);
  const [dbConnected, setDbConnected] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBillNo, setSavedBillNo] = useState('');

  // Check Backend PHP/MySQL connection on mount
  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const types = await apiService.getWoodTypes();
      if (types && Array.isArray(types) && types.length > 0) {
        setWoodTypes(types);
        setDbConnected(true);
      } else {
        setDbConnected(false);
      }
    } catch (err) {
      setDbConnected(false);
    }
  };

  // Calculations
  const calculateTotals = () => {
    let totalCft = 0;
    let subtotal = 0;

    items.forEach((item) => {
      const lengthFt = parseFloat(item.length_ft) || 0;
      const widthIn = parseFloat(item.width_in) || 0;
      const thicknessIn = parseFloat(item.thickness_in) || 0;
      const pcs = parseInt(item.pcs) || 1;
      const rate = parseFloat(item.rate_per_cft) || 0;

      const cftPerPc = (lengthFt * widthIn * thicknessIn) / 144;
      const itemCft = cftPerPc * pcs;
      const itemAmount = itemCft * rate;

      totalCft += itemCft;
      subtotal += itemAmount;
    });

    const cutting = parseFloat(cuttingCharges) || 0;
    const transport = parseFloat(transportCharges) || 0;
    const taxP = parseFloat(taxPercent) || 0;
    const disc = parseFloat(discount) || 0;

    const taxAmt = (subtotal * taxP) / 100;
    const grandTotal = subtotal + cutting + transport + taxAmt - disc;

    return { totalCft, subtotal, grandTotal };
  };

  const { totalCft, subtotal: subtotalAmount, grandTotal } = calculateTotals();

  // Handlers for Items Table
  const handleAddItem = () => {
    const defaultWood = woodTypes[0] || DEFAULT_WOOD_TYPES[0];
    const newItem = {
      id: Date.now(),
      wood_type: defaultWood.name,
      length_ft: '',
      width_in: '',
      thickness_in: '',
      pcs: 1,
      rate_per_cft: defaultWood.default_rate_per_cft || 2200
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleDuplicateItem = (id) => {
    const found = items.find(item => item.id === id);
    if (found) {
      setItems([...items, { ...found, id: Date.now() }]);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all sizes from calculation table?")) {
      const firstWood = woodTypes[0] || DEFAULT_WOOD_TYPES[0];
      setItems([{
        id: Date.now(),
        wood_type: firstWood.name,
        length_ft: '',
        width_in: '',
        thickness_in: '',
        pcs: 1,
        rate_per_cft: firstWood.default_rate_per_cft || 2200
      }]);
      setSavedBillNo('');
    }
  };

  const handleNewOrder = () => {
    const firstWood = woodTypes[0] || DEFAULT_WOOD_TYPES[0];
    setItems([
      { id: Date.now(), wood_type: firstWood.name, length_ft: '', width_in: '', thickness_in: '', pcs: 1, rate_per_cft: firstWood.default_rate_per_cft || 2200 }
    ]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setCuttingCharges(0);
    setTransportCharges(0);
    setTaxPercent(0);
    setDiscount(0);
    setPaymentStatus('Paid');
    setNotes('');
    setSavedBillNo('');
  };

  const handleSelectWoodFromRates = (wood) => {
    setItems([
      ...items,
      {
        id: Date.now(),
        wood_type: wood.name,
        length_ft: 10,
        width_in: 4,
        thickness_in: 3,
        pcs: 1,
        rate_per_cft: wood.default_rate_per_cft
      }
    ]);
    setActivePage('billing');
  };

  const handleAddWoodType = async (newWood) => {
    setWoodTypes([...woodTypes, newWood]);
    try {
      await apiService.saveWoodType(newWood);
      const updated = await apiService.getWoodTypes();
      if (updated) setWoodTypes(updated);
    } catch (e) {
      console.log("Wood type saved to local state");
    }
  };

  const handleSaveOrderToBackend = async () => {
    if (!customerName.trim()) {
      alert("Please enter Customer Name before saving bill.");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least one timber size row.");
      return;
    }

    setIsSaving(true);
    const orderPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      order_date: orderDate,
      items: items,
      cutting_charges: cuttingCharges,
      transport_charges: transportCharges,
      tax_percent: taxPercent,
      discount: discount,
      notes: notes,
      payment_status: paymentStatus
    };

    try {
      const res = await apiService.saveOrder(orderPayload);
      if (res.success && res.data) {
        setSavedBillNo(res.data.bill_no);
        setDbConnected(true);
        alert(`Bill ${res.data.bill_no} saved successfully to database!`);
      } else {
        alert("Bill processed in preview mode. (Note: Check database connection).");
      }
    } catch (err) {
      alert("Bill ready in preview mode! (Check database connection).");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectOrderFromHistory = async (orderId) => {
    try {
      const ord = await apiService.getOrderById(orderId);
      if (ord) {
        setCustomerName(ord.customer_name);
        setCustomerPhone(ord.customer_phone || '');
        setCustomerAddress(ord.customer_address || '');
        setOrderDate(ord.order_date);
        setCuttingCharges(ord.cutting_charges || 0);
        setTransportCharges(ord.transport_charges || 0);
        setTaxPercent(ord.tax_percent || 0);
        setDiscount(ord.discount || 0);
        setNotes(ord.notes || '');
        setPaymentStatus(ord.payment_status || 'Paid');
        setSavedBillNo(ord.bill_no);

        if (ord.items && ord.items.length > 0) {
          setItems(ord.items.map((it, i) => ({
            id: it.id || i + 1,
            wood_type: it.wood_type,
            length_ft: it.length_ft,
            width_in: it.width_in,
            thickness_in: it.thickness_in,
            pcs: it.pcs,
            rate_per_cft: it.rate_per_cft
          })));
        }
        setActivePage('billing');
        setIsReceiptOpen(true);
      }
    } catch (e) {
      console.warn("Error fetching selected order:", e);
    }
  };

  return (
    <div className="app-layout">
      {/* Left Sidebar Navigation */}
      <Sidebar 
        activePage={activePage}
        onNavigate={setActivePage}
        onNewOrder={handleNewOrder}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenRates={() => setIsRatesOpen(true)}
        dbConnected={dbConnected}
        itemsCount={items.length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content-layout">
        {/* Top Navbar */}
        <Navbar 
          activePage={activePage}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Content Body Rendering Active Page */}
        <main className="content-body">
          {activePage === 'dashboard' && (
            <DashboardPage 
              onNavigate={setActivePage}
              onNewOrder={handleNewOrder}
              onSelectOrder={handleSelectOrderFromHistory}
              woodTypes={woodTypes}
            />
          )}

          {activePage === 'add-receipt' && (
            <AddReceiptPage woodTypes={woodTypes} />
          )}

          {activePage === 'billing' && (
            <BillingPage 
              woodTypes={woodTypes}
              onOpenRates={() => setIsRatesOpen(true)}
            />
          )}

          {activePage === 'daily-retail' && (
            <DailyRetailPage />
          )}

          {activePage === 'employee-management' && (
            <EmployeeManagementPage />
          )}
        </main>
      </div>

      {/* Modals for Billing & Rates */}
      <ReceiptModal 
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        customerName={customerName}
        customerPhone={customerPhone}
        customerAddress={customerAddress}
        orderDate={orderDate}
        items={items}
        cuttingCharges={cuttingCharges}
        transportCharges={transportCharges}
        taxPercent={taxPercent}
        discount={discount}
        paymentStatus={paymentStatus}
        notes={notes}
        subtotalAmount={subtotalAmount}
        totalCft={totalCft}
        grandTotal={grandTotal}
        onSaveOrder={handleSaveOrderToBackend}
        isSaving={isSaving}
        savedBillNo={savedBillNo}
      />

      <WoodRatesModal 
        isOpen={isRatesOpen}
        onClose={() => setIsRatesOpen(false)}
        woodTypes={woodTypes}
        onSelectWood={handleSelectWoodFromRates}
        onAddWoodType={handleAddWoodType}
      />

      <OrderHistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectOrder={handleSelectOrderFromHistory}
      />
    </div>
  );
}
