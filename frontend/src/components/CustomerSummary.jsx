import React from 'react';
import { User, Scissors, Truck, Tag, Receipt, FileText, CheckCircle2 } from 'lucide-react';

export default function CustomerSummary({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  orderDate,
  setOrderDate,
  cuttingCharges,
  setCuttingCharges,
  transportCharges,
  setTransportCharges,
  taxPercent,
  setTaxPercent,
  discount,
  setDiscount,
  paymentStatus,
  setPaymentStatus,
  notes,
  setNotes,
  subtotalAmount,
  totalCft,
  grandTotal,
  onOpenReceipt,
  itemsCount = 0
}) {
  return (
    <div className="glass-panel" style={{ marginTop: '16px', padding: '18px 20px' }}>
      <div className="panel-header" style={{ marginBottom: '14px', paddingBottom: '10px' }}>
        <div className="panel-title">
          <User className="panel-icon" size={20} />
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
            Customer Details & Bill Summary
          </span>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px', 
        alignItems: 'stretch' 
      }}>
        {/* Column 1: Customer Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            1. Customer Information
          </span>

          <div className="field-group">
            <label className="field-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
              Customer Name *
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Ramesh Kumar / Verma Furniture"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ fontSize: '0.95rem', fontWeight: 600, padding: '8px 10px' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Phone Number
              </label>
              <input 
                type="tel" 
                className="input-field" 
                placeholder="9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ fontSize: '0.9rem', padding: '8px 10px' }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Bill Date
              </label>
              <input 
                type="date" 
                className="input-field" 
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                style={{ fontSize: '0.9rem', fontWeight: 600, padding: '7px 8px' }}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
              Site / Delivery Address
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Near Bus Stand / Site Location"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '8px 10px' }}
            />
          </div>
        </div>

        {/* Column 2: Extra Charges & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            2. Extra Charges & Payment
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                <Scissors size={13} /> Cutting (₹)
              </label>
              <input 
                type="number" 
                min="0"
                step="any"
                className="input-field font-mono" 
                placeholder="0"
                value={cuttingCharges}
                onChange={(e) => setCuttingCharges(e.target.value)}
                style={{ fontSize: '0.9rem', padding: '8px 10px' }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                <Truck size={13} /> Transport (₹)
              </label>
              <input 
                type="number" 
                min="0"
                step="any"
                className="input-field font-mono" 
                placeholder="0"
                value={transportCharges}
                onChange={(e) => setTransportCharges(e.target.value)}
                style={{ fontSize: '0.9rem', padding: '8px 10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#E11D48', fontSize: '0.8rem' }}>
                <Tag size={13} /> Discount (₹)
              </label>
              <input 
                type="number" 
                min="0"
                step="any"
                className="input-field font-mono" 
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                style={{ fontSize: '0.9rem', color: '#E11D48', fontWeight: 700, padding: '8px 10px' }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Payment Status
              </label>
              <select 
                className="input-field" 
                style={{ fontWeight: 700, padding: '8px 8px', fontSize: '0.9rem' }}
                value={paymentStatus} 
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Due / Pending</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
              Delivery Notes / Remarks
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Paid via UPI, evening dispatch"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '8px 10px' }}
            />
          </div>
        </div>

        {/* Column 3: Grand Total & Print Action */}
        <div style={{ 
          background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', 
          borderRadius: '12px', 
          border: '2px solid #FCD34D',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
              3. Bill Total & Action
            </span>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Total Volume:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#B45309', fontSize: '0.95rem' }}>
                {totalCft.toFixed(3)} CFT
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Wood Subtotal:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#0F172A', fontSize: '0.95rem' }}>
                ₹{subtotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </strong>
            </div>

            <hr style={{ borderColor: 'rgba(217, 119, 6, 0.25)', margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#92400E' }}>
                  GRAND TOTAL
                </span>
                <span style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>
                  Total Payable
                </span>
              </div>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '1.65rem', 
                fontWeight: 800, 
                color: '#047857' 
              }}>
                ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {onOpenReceipt && (
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={onOpenReceipt}
              disabled={itemsCount === 0}
              style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: '12px 16px', fontSize: '0.95rem' }}
            >
              <Receipt size={18} />
              <span>Generate & Print Bill</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
