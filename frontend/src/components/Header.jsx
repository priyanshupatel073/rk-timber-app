import React from 'react';
import { 
  Trees, 
  PlusCircle, 
  History, 
  Tag, 
  Receipt, 
  Database,
  LayoutDashboard,
  Calculator,
  ShoppingBag,
  Users,
  FilePlus2
} from 'lucide-react';

export default function Header({ 
  activePage,
  onNavigate,
  onNewOrder, 
  onOpenHistory, 
  onOpenRates, 
  onOpenReceipt, 
  dbConnected, 
  itemsCount 
}) {
  const navTabs = [
    { id: 'dashboard', label: '1. DASHBOARD', icon: LayoutDashboard, badge: null },
    { id: 'add-receipt', label: '2. ADD RECEIPT', icon: FilePlus2, badge: 'New' },
    { id: 'billing', label: '3. BILLING', icon: Calculator, badge: itemsCount > 0 ? `${itemsCount}` : null },
    { id: 'daily-retail', label: '4. DAILY RETAIL', icon: ShoppingBag, badge: null },
    { id: 'employee-management', label: '5. EMPLOYEE MANAGEMENT', icon: Users, badge: null }
  ];

  return (
    <header className="header-card">
      <div className="header-top-row">
        <div className="brand-section">
          <img 
            src="/rk_wood_logo.png" 
            alt="R.K. WOOD INDUSTRIES" 
            style={{ height: '40px', width: 'auto', objectFit: 'contain', display: 'block' }} 
          />
          <div>
            <h1 className="brand-title">R.K. WOOD INDUSTRIES</h1>
            <p className="brand-subtitle">MFG. OF QUALITY WOODEN BOXES, PALLETS & TIMBER MERCHANTS</p>
          </div>
        </div>

        <div className="header-actions">
          <div 
            className={`status-indicator ${!dbConnected ? 'offline' : ''}`} 
            style={!dbConnected ? { background: '#FFE4E6', borderColor: '#FECDD3', color: '#E11D48' } : {}}
          >
            <span className="status-dot" style={!dbConnected ? { backgroundColor: '#E11D48', boxShadow: '0 0 6px #E11D48' } : {}} />
            <Database size={14} />
            <span>{dbConnected ? 'MySQL Connected' : 'Local Fallback'}</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onOpenRates} title="Predefined Wood Species & Rates">
            <Tag size={15} />
            <span>Wood Rates</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={onOpenHistory} title="View Saved Customer Bills">
            <History size={15} />
            <span>Saved Bills</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => {
              onNewOrder();
              onNavigate('billing');
            }} 
            title="Reset and Start New Bill"
          >
            <PlusCircle size={15} />
            <span>New Bill</span>
          </button>

          {activePage === 'billing' && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onOpenReceipt} 
              disabled={itemsCount === 0} 
              title="Generate Customer Receipt"
            >
              <Receipt size={15} />
              <span>Bill Preview ({itemsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="header-nav-tabs">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(tab.id)}
            >
              <Icon size={17} className="nav-tab-icon" />
              <span className="nav-tab-text">{tab.label}</span>
              {tab.badge && (
                <span className={`nav-tab-badge ${isActive ? 'active' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
