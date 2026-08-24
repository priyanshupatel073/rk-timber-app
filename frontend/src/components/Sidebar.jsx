import React from 'react';
import {
  Trees,
  LayoutDashboard,
  Calculator,
  ShoppingBag,
  Users,
  Receipt,
  Tag,
  History,
  PlusCircle,
  Database,
  X
} from 'lucide-react';

export default function Sidebar({
  activePage,
  onNavigate,
  isMobileOpen,
  onCloseMobile
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', sub: 'Overview & Statistics', icon: LayoutDashboard },
    { id: 'billing', label: 'Timber Billing', sub: 'Tax Invoices & Billing', icon: Calculator },
    { id: 'add-receipt', label: 'Quick Receipt', sub: 'Cash Receipt Slip', icon: Receipt },
    { id: 'daily-retail', label: 'Daily Retail', sub: 'Daily retail & Cash Flow', icon: ShoppingBag }
  ];

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-header" style={{ padding: '20px 18px', borderBottom: '1.5px solid #E2E8F0' }}>
          <div className="sidebar-brand-box">
            <img
              src="/rk_wood_logo.png"
              alt="R.K. WOOD INDUSTRIES"
              style={{ width: '42px', height: '42px', objectFit: 'contain', display: 'block' }}
            />
            <div className="sidebar-brand-text">
              <h2 className="sidebar-brand-title" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2E227F', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
                R.K. WOOD
              </h2>
              <span className="sidebar-brand-sub" style={{ color: '#2E227F', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.6px' }}>
                INDUSTRIES
              </span>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={onCloseMobile}>
            <X size={20} />
          </button>
        </div>

        {/* Expanded Main Navigation List */}
        <div className="sidebar-scrollable-content" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="sidebar-section-label" style={{ fontSize: '0.8rem', fontWeight: 900, color: '#64748B', letterSpacing: '1.2px', marginBottom: '4px' }}>
            MAIN MENU
          </div>

          <nav className="sidebar-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <div className="nav-item-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: isActive ? 'rgba(255, 255, 255, 0.2)' : '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isActive ? '#FFFFFF' : '#2E227F',
                      flexShrink: 0
                    }}>
                      <Icon size={21} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <span className="nav-item-label" style={{ display: 'block', fontSize: '1rem', fontWeight: isActive ? 900 : 700, color: isActive ? '#FFFFFF' : '#0F172A', lineHeight: 1.2 }}>
                        {item.label}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: isActive ? '#E0E7FF' : '#64748B', marginTop: '2px' }}>
                        {item.sub}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
