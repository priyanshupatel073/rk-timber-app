import pool from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM wood_types ORDER BY name ASC');
      return res.status(200).json({ status: 'success', data: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, default_rate_per_cft, category } = body || {};

      if (!name || default_rate_per_cft === undefined) {
        return res.status(400).json({ status: 'error', message: 'Name and rate per CFT are required' });
      }

      const trimmedName = String(name).trim();
      const rate = parseFloat(default_rate_per_cft) || 0;
      const cat = (category && String(category).trim()) || 'General Wood';

      const [existing] = await pool.query('SELECT id FROM wood_types WHERE name = ? LIMIT 1', [trimmedName]);

      if (existing.length > 0) {
        const id = existing[0].id;
        await pool.query('UPDATE wood_types SET default_rate_per_cft = ?, category = ? WHERE id = ?', [rate, cat, id]);
        return res.status(200).json({
          status: 'success',
          message: 'Wood rate updated successfully',
          id,
          data: { id, name: trimmedName, default_rate_per_cft: rate, category: cat }
        });
      } else {
        const [result] = await pool.query('INSERT INTO wood_types (name, default_rate_per_cft, category) VALUES (?, ?, ?)', [trimmedName, rate, cat]);
        const id = result.insertId;
        return res.status(200).json({
          status: 'success',
          message: 'Wood type added successfully',
          id,
          data: { id, name: trimmedName, default_rate_per_cft: rate, category: cat }
        });
      }
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) {
        return res.status(400).json({ status: 'error', message: 'Wood type ID is required' });
      }
      await pool.query('DELETE FROM wood_types WHERE id = ?', [id]);
      return res.status(200).json({ status: 'success', message: 'Wood type removed successfully' });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  } catch (err) {
    console.error('Wood types API error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
