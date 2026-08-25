import pool from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { date, id } = req.query;

      if (date) {
        const [rows] = await pool.query('SELECT * FROM daily_retail WHERE entry_date = ? LIMIT 1', [date]);
        if (rows.length > 0) {
          const row = rows[0];
          try { row.debit_entries = typeof row.debit_entries === 'string' ? JSON.parse(row.debit_entries) : (row.debit_entries || []); } catch (e) { row.debit_entries = []; }
          try { row.credit_entries = typeof row.credit_entries === 'string' ? JSON.parse(row.credit_entries) : (row.credit_entries || []); } catch (e) { row.credit_entries = []; }
          return res.status(200).json({ status: 'success', data: row });
        }
        return res.status(200).json({ status: 'success', data: null });
      }

      if (id) {
        const [rows] = await pool.query('SELECT * FROM daily_retail WHERE id = ? LIMIT 1', [parseInt(id, 10)]);
        if (rows.length > 0) {
          const row = rows[0];
          try { row.debit_entries = typeof row.debit_entries === 'string' ? JSON.parse(row.debit_entries) : (row.debit_entries || []); } catch (e) { row.debit_entries = []; }
          try { row.credit_entries = typeof row.credit_entries === 'string' ? JSON.parse(row.credit_entries) : (row.credit_entries || []); } catch (e) { row.credit_entries = []; }
          return res.status(200).json({ status: 'success', data: row });
        }
        return res.status(404).json({ status: 'error', message: 'Record not found' });
      }

      const [rows] = await pool.query('SELECT * FROM daily_retail ORDER BY entry_date DESC');
      for (const row of rows) {
        try { row.debit_entries = typeof row.debit_entries === 'string' ? JSON.parse(row.debit_entries) : (row.debit_entries || []); } catch (e) { row.debit_entries = []; }
        try { row.credit_entries = typeof row.credit_entries === 'string' ? JSON.parse(row.credit_entries) : (row.credit_entries || []); } catch (e) { row.credit_entries = []; }
      }
      return res.status(200).json({ status: 'success', data: rows });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { entry_date, debit_total, credit_total, sub_amount, debit_entries, credit_entries, notes } = body || {};

      if (!entry_date) {
        return res.status(400).json({ status: 'error', message: 'Valid entry_date is required.' });
      }

      const dTotal = parseFloat(debit_total) || 0;
      const cTotal = parseFloat(credit_total) || 0;
      const subAmt = parseFloat(sub_amount) || (dTotal - cTotal);
      const dEntries = JSON.stringify(Array.isArray(debit_entries) ? debit_entries : []);
      const cEntries = JSON.stringify(Array.isArray(credit_entries) ? credit_entries : []);
      const noteStr = notes ? String(notes).trim() : '';

      const [existing] = await pool.query('SELECT id FROM daily_retail WHERE entry_date = ? LIMIT 1', [entry_date]);

      let recordId;
      if (existing.length > 0) {
        recordId = existing[0].id;
        await pool.query(
          `UPDATE daily_retail SET debit_total = ?, credit_total = ?, sub_amount = ?, debit_entries = ?, credit_entries = ?, notes = ?, updated_at = NOW() WHERE id = ?`,
          [dTotal, cTotal, subAmt, dEntries, cEntries, noteStr, recordId]
        );
      } else {
        const [insertRes] = await pool.query(
          `INSERT INTO daily_retail (entry_date, debit_total, credit_total, sub_amount, debit_entries, credit_entries, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry_date, dTotal, cTotal, subAmt, dEntries, cEntries, noteStr]
        );
        recordId = insertRes.insertId;
      }

      return res.status(200).json({
        status: 'success',
        message: `Daily retail ledger for ${entry_date} saved successfully.`,
        data: {
          id: recordId,
          entry_date,
          debit_total: dTotal,
          credit_total: cTotal,
          sub_amount: subAmt
        }
      });
    }

    if (req.method === 'DELETE') {
      const { id, date } = req.query;
      if (id) {
        await pool.query('DELETE FROM daily_retail WHERE id = ?', [parseInt(id, 10)]);
        return res.status(200).json({ status: 'success', message: 'Daily retail entry deleted.' });
      } else if (date) {
        await pool.query('DELETE FROM daily_retail WHERE entry_date = ?', [date]);
        return res.status(200).json({ status: 'success', message: `Daily retail entry for ${date} deleted.` });
      }
      return res.status(400).json({ status: 'error', message: 'ID or Date is required for delete.' });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  } catch (err) {
    console.error('Daily retail API error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
