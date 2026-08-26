import pool from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const host = process.env.DB_HOST || 'mysql-1782bc84-priyanshupatel773-8dd.e.aivencloud.com';
  const port = process.env.DB_PORT || '28049';
  const user = process.env.DB_USER || 'avnadmin';
  const db = process.env.DB_NAME || 'rk_timber_db';

  try {
    const [result] = await pool.query('SELECT 1 AS connected, NOW() AS server_time');
    let tables = [];
    try {
      const [tRows] = await pool.query('SHOW TABLES');
      tables = tRows.map(r => Object.values(r)[0]);
    } catch (te) {}

    let dailyCount = 0;
    try {
      const [cRows] = await pool.query('SELECT COUNT(*) AS total FROM daily_retail');
      dailyCount = cRows[0]?.total || 0;
    } catch (ce) {}

    return res.status(200).json({
      status: 'success',
      database: 'connected',
      host,
      port,
      database_name: db,
      server_time: result[0]?.server_time,
      tables,
      daily_retail_count: dailyCount
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      database: 'failed',
      host,
      port,
      error_code: err.code,
      error_message: err.message,
      hint: err.code === 'ENOTFOUND' 
        ? 'The Aiven database hostname could not be found in DNS. Please check if the service is in POWEROFF status on console.aiven.io and click Power on, or check if the hostname has changed.'
        : err.message
    });
  }
}
