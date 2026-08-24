import React from 'react';
import { Calendar, Menu } from 'lucide-react';

export default function Navbar({
  activePage,
  onOpenMobileSidebar
}) {
  const pageTitles = {
    'dashboard': 'Dashboard Overview',
    'billing': 'Invoice & Timber Billing',
    'add-receipt': 'Quick Cash Receipt',
    'daily-retail': 'Daily Retail Counter',
    'employee-management': 'Staff Attendance & Wages'
  };

  const currentTitle = pageTitles[activePage] || 'R.K. WOOD INDUSTRIES';

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="top-navbar">
      <div className="top-navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Mobile Hamburger Menu Button */}
        <button 
          type="button"
          className="mobile-menu-toggle-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Open Navigation Sidebar"
          title="Open Menu"
        >
          <Menu size={20} />
        </button>

        <h1 className="navbar-main-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', margin: 0 }}>
          {currentTitle}
        </h1>
      </div>

      <div className="top-navbar-right">
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: '#F8FAFC', 
          border: '1px solid #E2E8F0', 
          padding: '6px 12px', 
          borderRadius: '20px', 
          fontSize: '0.82rem', 
          fontWeight: 600, 
          color: '#475569' 
        }}>
          <Calendar size={14} className="text-amber" />
          <span className="navbar-date-text">{todayStr}</span>
        </div>
      </div>
    </header>
  );
}
