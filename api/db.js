import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-1782bc84-priyanshupatel773-8dd.e.aivencloud.com',
  port: parseInt(process.env.DB_PORT || '28049', 10),
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASS || Buffer.from('QVZOU18yai02aTlia2pYTVplNnhVWTBz', 'base64').toString('utf-8'),
  database: process.env.DB_NAME || 'rk_timber_db',
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
