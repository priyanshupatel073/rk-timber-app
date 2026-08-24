import React from 'react';
import { X, Printer, Save, CheckCircle, Trees, MessageSquare } from 'lucide-react';

export default function ReceiptModal({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  customerAddress,
  orderDate,
  items,
  cuttingCharges,
  transportCharges,
  taxPercent,
  discount,
  paymentStatus,
  notes,
  subtotalAmount,
  totalCft,
  grandTotal,
  onSaveOrder,
  isSaving,
  savedBillNo
}) {
  if (!isOpen) return null;

  const billNo = savedBillNo || `RK-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    let rawPhone = (customerPhone || '').trim();
    if (!rawPhone) {
      rawPhone = window.prompt(`Enter customer WhatsApp number for Receipt #${billNo}:`, '') || '';
    }

    let phoneClean = rawPhone.replace(/\D/g, '');
    if (phoneClean.startsWith('0') && phoneClean.length === 11) {
      phoneClean = phoneClean.slice(1);
    }
    const validPhone = phoneClean.length === 10 
      ? `91${phoneClean}` 
      : (phoneClean.length === 12 && phoneClean.startsWith('91') ? phoneClean : (phoneClean.length >= 10 ? phoneClean : ''));

    let text = `🧾 *R.K. WOOD INDUSTRIES - CASH RECEIPT*\n`;
    text += `📍 Ankleshwar | 📞 9879810196 / 9377510359\n`;
    text += `------------------------------------\n`;
    text += `*Receipt No:* ${billNo}\n`;
    text += `*Date:* ${orderDate}\n`;
    text += `*Customer:* ${(customerName || 'Valued Customer').toUpperCase()}\n`;
    if (rawPhone) text += `*Mobile:* ${rawPhone}\n`;
    text += `*Payment Status:* ${paymentStatus || 'Paid'}\n`;
    text += `------------------------------------\n`;
    text += `*WOODEN SIZES & VOLUMES:*\n`;

    items.forEach((item, idx) => {
      const lengthFt = parseFloat(item.length_ft) || 0;
      const widthIn = parseFloat(item.width_in) || 0;
      const thicknessIn = parseFloat(item.thickness_in) || 0;
      const pcs = parseInt(item.pcs) || 1;
      const rate = parseFloat(item.rate_per_cft) || 0;
      const itemCft = ((lengthFt * widthIn * thicknessIn) / 144) * pcs;
      const itemAmt = itemCft * rate;

      text += `${idx + 1}. *${item.wood_type || 'Wood'}*: ${lengthFt}' × ${widthIn}" × ${thicknessIn}" (${pcs} pcs) = ${itemCft.toFixed(3)} CFT @ ₹${rate} = *₹${itemAmt.toFixed(2)}*\n`;
    });

    text += `------------------------------------\n`;
    text += `*Total Volume:* ${totalCft.toFixed(3)} CFT\n`;
    text += `*Wood Subtotal:* ₹${subtotalAmount.toFixed(2)}\n`;
    if (parseFloat(cuttingCharges) > 0) text += `*Cutting Charges:* +₹${parseFloat(cuttingCharges).toFixed(2)}\n`;
    if (parseFloat(transportCharges) > 0) text += `*Transport:* +₹${parseFloat(transportCharges).toFixed(2)}\n`;
    if (parseFloat(discount) > 0) text += `*Discount:* -₹${parseFloat(discount).toFixed(2)}\n`;
    text += `*GRAND TOTAL:* *₹${grandTotal.toFixed(2)}*/-\n`;
    text += `------------------------------------\n`;
    text += `Thank you for your business! 🙏\n*R.K. WOOD INDUSTRIES*`;

    const encodedText = encodeURIComponent(text);
    const url = validPhone 
      ? `https://api.whatsapp.com/send?phone=${validPhone}&text=${encodedText}` 
      : `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(url, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        {/* Action Header - Hidden during print */}
        <div className="panel-header no-print modal-action-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title">
            <Trees className="panel-icon" size={22} />
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
              Receipt Voucher Preview
            </span>
          </div>
          
          <div className="modal-action-btns" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleWhatsAppShare} 
              style={{ background: '#059669', color: '#FFF', borderColor: '#059669', fontWeight: 600 }}
              title="Share bill on WhatsApp"
            >
              <MessageSquare size={16} />
              <span>WhatsApp</span>
            </button>

            <button 
              className="btn btn-primary" 
              onClick={handlePrint}
              style={{ fontWeight: 700 }}
              title="Print receipt on printer"
            >
              <Printer size={16} />
              <span>Print Bill</span>
            </button>

            <button 
              className="btn btn-success" 
              onClick={onSaveOrder} 
              disabled={isSaving}
              style={{ fontWeight: 700 }}
              title="Save bill in database"
            >
              {isSaving ? <CheckCircle size={16} /> : <Save size={16} />}
              <span>{isSaving ? 'Saving...' : 'Save Bill'}</span>
            </button>

            <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="receipt-paper" style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
          <div className="receipt-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img 
                src="/rk_wood_logo.png" 
                alt="R.K. WOOD INDUSTRIES" 
                style={{ height: '56px', width: 'auto', objectFit: 'contain' }} 
              />
              <div>
                <h2 className="receipt-shop-name" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E1B4B', letterSpacing: '0.5px', margin: 0 }}>
                  R.K. WOOD INDUSTRIES
                </h2>
                <p className="receipt-shop-info" style={{ fontSize: '0.82rem', color: '#4338CA', fontWeight: 700, margin: '2px 0 0 0' }}>
                  MFG. OF QUALITY WOODEN BOXES, PALLETS & TIMBER MERCHANTS
                </p>
                <p className="receipt-shop-info" style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  ANKLESHWAR - 393001 | MO. 9879810196 / 9377510359
                </p>
              </div>
            </div>
            <div className="receipt-bill-meta" style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', background: '#FEF3C7', color: '#B45309', padding: '4px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                {billNo}
              </div>
              <p style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                Date: {orderDate}
              </p>
            </div>
          </div>

          {/* Customer Meta Box */}
          <div className="receipt-cust-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #E2E8F0', marginTop: '8px' }}>
            <div>
              <p style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Customer Name
              </p>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0F172A' }}>
                {customerName || 'Valued Customer'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Mobile & Location
              </p>
              <p style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.95rem' }}>
                {customerPhone || 'N/A'} {customerAddress ? `(${customerAddress})` : ''}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <table className="receipt-table" style={{ width: '100%', marginTop: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                <th style={{ width: '30px', padding: '8px 6px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Wood Description</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Size (W" × T")</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Length (Ft)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Pcs</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>CFT/Pc</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Total CFT</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const lengthFt = parseFloat(item.length_ft) || 0;
                const widthIn = parseFloat(item.width_in) || 0;
                const thicknessIn = parseFloat(item.thickness_in) || 0;
                const pcs = parseInt(item.pcs) || 1;
                const rate = parseFloat(item.rate_per_cft) || 0;
                const cftPerPc = (lengthFt * widthIn * thicknessIn > 0) ? (lengthFt * widthIn * thicknessIn) / 144 : 0;
                const itemCft = cftPerPc * pcs;
                const itemAmt = itemCft * rate;

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600, color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, padding: '8px', color: '#0F172A' }}>{item.wood_type || 'Standard Wood'}</td>
                    <td style={{ textAlign: 'center', padding: '8px' }}>{widthIn}" × {thicknessIn}"</td>
                    <td style={{ textAlign: 'center', padding: '8px' }}>{lengthFt} ft</td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800 }}>{pcs}</td>
                    <td style={{ textAlign: 'center', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{cftPerPc.toFixed(3)}</td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#B45309' }}>{itemCft.toFixed(3)}</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'var(--font-mono)' }}>₹{rate.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#047857' }}>
                      ₹{itemAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="receipt-totals" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', maxWidth: '350px' }}>
              <div style={{ marginBottom: '4px' }}>
                Total Items: <strong>{items.length} size{items.length === 1 ? '' : 's'}</strong>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Total Pieces: <strong>{items.reduce((s, i) => s + (parseInt(i.pcs) || 0), 0)} Pieces</strong>
              </div>
              {notes && (
                <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#64748B' }}>
                  Note: {notes}
                </div>
              )}
            </div>

            <div style={{ minWidth: '280px' }}>
              <div className="receipt-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                <span style={{ color: '#475569' }}>Wood Subtotal:</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>₹{subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="receipt-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                <span style={{ color: '#475569' }}>Total Volume:</span>
                <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#B45309' }}>{totalCft.toFixed(3)} CFT</span>
              </div>

              {parseFloat(cuttingCharges) > 0 && (
                <div className="receipt-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                  <span style={{ color: '#475569' }}>Cutting / Sawing:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>+₹{parseFloat(cuttingCharges).toFixed(2)}</span>
                </div>
              )}

              {parseFloat(transportCharges) > 0 && (
                <div className="receipt-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                  <span style={{ color: '#475569' }}>Transport:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>+₹{parseFloat(transportCharges).toFixed(2)}</span>
                </div>
              )}

              {parseFloat(discount) > 0 && (
                <div className="receipt-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#E11D48' }}>
                  <span>Discount:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>-₹{parseFloat(discount).toFixed(2)}</span>
                </div>
              )}

              <div className="receipt-grand-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #0F172A', marginTop: '6px', fontSize: '1.25rem', fontWeight: 800 }}>
                <span style={{ color: '#0F172A' }}>GRAND TOTAL:</span>
                <span style={{ color: '#047857', fontFamily: 'var(--font-mono)' }}>
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: paymentStatus === 'Paid' ? '#059669' : '#D97706' }}>
                Payment Status: {paymentStatus}
              </div>
            </div>
          </div>

          <div className="receipt-footer" style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
              <p style={{ fontWeight: 600 }}>Thank you for your business!</p>
              <p style={{ fontSize: '0.72rem', marginTop: '2px' }}>Computer Generated Estimate Voucher</p>
            </div>

            <div style={{ textAlign: 'center', minWidth: '160px' }}>
              <div style={{ height: '36px' }} />
              <div style={{ borderTop: '1px solid #64748B', paddingTop: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
