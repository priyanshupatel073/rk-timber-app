import pool from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { id, stats, search } = req.query;

      if (id) {
        const orderId = parseInt(id, 10);
        const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
          return res.status(404).json({ status: 'error', message: 'Order not found' });
        }
        const order = orders[0];
        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [orderId]);
        order.items = items;
        return res.status(200).json({ status: 'success', data: order });
      }

      if (stats) {
        const today = new Date().toISOString().slice(0, 10);

        const [[todayMetrics]] = await pool.query(
          `SELECT COALESCE(SUM(grand_total), 0) AS today_sales, COUNT(*) AS today_orders_count, COALESCE(SUM(total_cft), 0) AS today_cft FROM orders WHERE order_date = ?`,
          [today]
        );

        const [[allMetrics]] = await pool.query(
          `SELECT COALESCE(SUM(grand_total), 0) AS total_revenue, COUNT(*) AS total_orders_count, COALESCE(SUM(total_cft), 0) AS total_cft_all FROM orders`
        );

        const [[pendingMetrics]] = await pool.query(
          `SELECT COALESCE(SUM(grand_total), 0) AS pending_balance, COUNT(*) AS pending_count FROM orders WHERE payment_status IN ('Pending', 'Partial')`
        );

        const [[woodCount]] = await pool.query(`SELECT COUNT(*) AS wood_types_count FROM wood_types`);

        const [recentOrders] = await pool.query(
          `SELECT o.*, (SELECT COALESCE(SUM(pcs), 0) FROM order_items WHERE order_id = o.id) AS total_pcs, (SELECT wood_type FROM order_items WHERE order_id = o.id LIMIT 1) AS primary_wood FROM orders o ORDER BY o.id DESC LIMIT 10`
        );

        return res.status(200).json({
          status: 'success',
          data: {
            today_sales: parseFloat(todayMetrics.today_sales),
            today_orders_count: parseInt(todayMetrics.today_orders_count, 10),
            today_cft: parseFloat(todayMetrics.today_cft),
            total_revenue: parseFloat(allMetrics.total_revenue),
            total_orders_count: parseInt(allMetrics.total_orders_count, 10),
            total_cft_all: parseFloat(allMetrics.total_cft_all),
            pending_balance: parseFloat(pendingMetrics.pending_balance),
            pending_count: parseInt(pendingMetrics.pending_count, 10),
            wood_types_count: parseInt(woodCount.wood_types_count, 10),
            recent_orders: recentOrders
          }
        });
      }

      let query = `SELECT o.*, (SELECT COALESCE(SUM(pcs), 0) FROM order_items WHERE order_id = o.id) AS total_pcs, (SELECT wood_type FROM order_items WHERE order_id = o.id LIMIT 1) AS primary_wood FROM orders o`;
      let params = [];

      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        query += ` WHERE o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.bill_no LIKE ?`;
        params = [s, s, s];
      }

      query += ` ORDER BY o.id DESC LIMIT 100`;

      const [orders] = await pool.query(query, params);

      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const [allItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id ASC`, [orderIds]);
        const itemsByOrder = {};
        for (const item of allItems) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push(item);
        }
        for (const ord of orders) {
          ord.items = itemsByOrder[ord.id] || [];
        }
      }

      return res.status(200).json({ status: 'success', data: orders });
    }

    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const input = body || {};

      // Fast-path: Update payment status only
      if (
        (input.action === 'update_status') ||
        (input.payment_status && (input.id || input.bill_no) && (!input.items || !Array.isArray(input.items)))
      ) {
        const orderId = input.id && parseInt(input.id, 10) < 10000000000 ? parseInt(input.id, 10) : null;
        const billNo = input.bill_no ? String(input.bill_no).trim() : null;
        const status = input.payment_status ? String(input.payment_status).trim() : 'Paid';

        if (orderId) {
          await pool.query('UPDATE orders SET payment_status = ? WHERE id = ?', [status, orderId]);
        } else if (billNo) {
          await pool.query('UPDATE orders SET payment_status = ? WHERE bill_no = ?', [status, billNo]);
        }

        return res.status(200).json({
          status: 'success',
          message: `Payment status updated to ${status}`,
          data: { id: orderId, bill_no: billNo, payment_status: status }
        });
      }

      if (!input.customer_name || !input.customer_name.trim()) {
        return res.status(400).json({ status: 'error', message: 'Customer name is required' });
      }

      if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'At least one timber size line item is required' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const customerName = String(input.customer_name).trim();
        const customerPhone = input.customer_phone ? String(input.customer_phone).trim() : '';
        const customerAddress = input.customer_address ? String(input.customer_address).trim() : '';
        const orderDate = input.order_date || new Date().toISOString().slice(0, 10);
        const cuttingCharges = parseFloat(input.cutting_charges) || 0;
        const transportCharges = parseFloat(input.transport_charges) || 0;
        const taxPercent = parseFloat(input.tax_percent) || 0;
        const discount = parseFloat(input.discount) || 0;
        const notes = input.notes ? String(input.notes).trim() : '';
        const paymentStatus = input.payment_status || 'Paid';

        let totalCft = 0.0;
        let subtotal = 0.0;
        const itemsData = [];

        for (const item of input.items) {
          const woodType = item.wood_type ? String(item.wood_type).trim() : 'General Wood';
          const lengthFt = parseFloat(item.length_ft) || 0;
          const widthIn = parseFloat(item.width_in) || 0;
          const thicknessIn = parseFloat(item.thickness_in) || 0;
          const pcs = parseInt(item.pcs, 10) || 1;
          const ratePerCft = parseFloat(item.rate_per_cft) || 0;

          const cftPerPc = (lengthFt * widthIn * thicknessIn > 0) ? (lengthFt * widthIn * thicknessIn) / 144 : 0;
          const itemTotalCft = cftPerPc * pcs;
          const itemTotalAmount = itemTotalCft * ratePerCft;

          totalCft += itemTotalCft;
          subtotal += itemTotalAmount;

          itemsData.push({
            wood_type: woodType,
            length_ft: lengthFt,
            width_in: widthIn,
            thickness_in: thicknessIn,
            pcs,
            cft_per_pc: Math.round(cftPerPc * 10000) / 10000,
            total_cft: Math.round(itemTotalCft * 10000) / 10000,
            rate_per_cft: Math.round(ratePerCft * 100) / 100,
            total_amount: Math.round(itemTotalAmount * 100) / 100
          });
        }

        const taxAmount = (subtotal * taxPercent) / 100;
        const grandTotal = Math.max(0, subtotal + cuttingCharges + transportCharges + taxAmount - discount);

        let orderId = input.id && parseInt(input.id, 10) < 10000000000 ? parseInt(input.id, 10) : null;
        let billNo = input.bill_no ? String(input.bill_no).trim() : null;

        if (orderId) {
          const [exists] = await connection.query('SELECT id FROM orders WHERE id = ?', [orderId]);
          if (exists.length > 0) {
            billNo = billNo || `RK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${orderId}`;
            await connection.query(
              `UPDATE orders SET bill_no = ?, customer_name = ?, customer_phone = ?, customer_address = ?, order_date = ?, total_cft = ?, subtotal = ?, cutting_charges = ?, transport_charges = ?, tax_percent = ?, discount = ?, grand_total = ?, notes = ?, payment_status = ? WHERE id = ?`,
              [billNo, customerName, customerPhone, customerAddress, orderDate, totalCft, subtotal, cuttingCharges, transportCharges, taxPercent, discount, grandTotal, notes, paymentStatus, orderId]
            );
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
          } else {
            orderId = null;
          }
        }

        if (!orderId && billNo) {
          const [byBill] = await connection.query('SELECT id FROM orders WHERE bill_no = ?', [billNo]);
          if (byBill.length > 0) {
            orderId = byBill[0].id;
            await connection.query(
              `UPDATE orders SET customer_name = ?, customer_phone = ?, customer_address = ?, order_date = ?, total_cft = ?, subtotal = ?, cutting_charges = ?, transport_charges = ?, tax_percent = ?, discount = ?, grand_total = ?, notes = ?, payment_status = ? WHERE id = ?`,
              [customerName, customerPhone, customerAddress, orderDate, totalCft, subtotal, cuttingCharges, transportCharges, taxPercent, discount, grandTotal, notes, paymentStatus, orderId]
            );
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
          }
        }

        if (!orderId) {
          billNo = billNo || `RK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const [insertRes] = await connection.query(
            `INSERT INTO orders (bill_no, customer_name, customer_phone, customer_address, order_date, total_cft, subtotal, cutting_charges, transport_charges, tax_percent, discount, grand_total, notes, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [billNo, customerName, customerPhone, customerAddress, orderDate, totalCft, subtotal, cuttingCharges, transportCharges, taxPercent, discount, grandTotal, notes, paymentStatus]
          );
          orderId = insertRes.insertId;
        }

        for (const it of itemsData) {
          await connection.query(
            `INSERT INTO order_items (order_id, wood_type, length_ft, width_in, thickness_in, pcs, cft_per_pc, total_cft, rate_per_cft, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, it.wood_type, it.length_ft, it.width_in, it.thickness_in, it.pcs, it.cft_per_pc, it.total_cft, it.rate_per_cft, it.total_amount]
          );
        }

        await connection.commit();

        return res.status(200).json({
          status: 'success',
          message: 'Order saved successfully',
          data: {
            id: orderId,
            bill_no: billNo,
            customer_name: customerName,
            order_date: orderDate,
            grand_total: grandTotal,
            subtotal,
            total_cft: totalCft,
            payment_status: paymentStatus
          }
        });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }

    if (req.method === 'DELETE') {
      const id = req.query.id && parseInt(req.query.id, 10) < 10000000000 ? parseInt(req.query.id, 10) : null;
      const billNo = req.query.bill_no ? String(req.query.bill_no).trim() : null;

      if (!id && !billNo) {
        return res.status(400).json({ status: 'error', message: 'Order ID or Bill No is required' });
      }

      if (id) {
        await pool.query('DELETE FROM orders WHERE id = ?', [id]);
      }
      if (billNo) {
        await pool.query('DELETE FROM orders WHERE bill_no = ?', [billNo]);
      }

      return res.status(200).json({ status: 'success', message: 'Order deleted successfully' });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  } catch (err) {
    console.error('Orders API error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
