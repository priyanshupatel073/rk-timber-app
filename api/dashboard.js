import pool from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const month = (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month.trim()))
      ? req.query.month.trim()
      : new Date().toISOString().slice(0, 7);

    const monthPattern = `${month}-%`;

    // 1. Monthly Daily Retail Total
    const [[dailyData]] = await pool.query(
      `SELECT COALESCE(SUM(debit_total), 0) AS total_daily_debit, COALESCE(SUM(credit_total), 0) AS total_daily_credit, COALESCE(SUM(sub_amount), 0) AS total_daily_net, COUNT(*) AS days_recorded FROM daily_retail WHERE entry_date LIKE ?`,
      [monthPattern]
    );

    const totalDailyDebit = parseFloat(dailyData?.total_daily_debit || 0);
    const totalDailyCredit = parseFloat(dailyData?.total_daily_credit || 0);
    const totalDailyNet = parseFloat(dailyData?.total_daily_net || 0);

    // 2. Monthly Quick Receipts Total
    const [[quickData]] = await pool.query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_quick_receipts, COALESCE(SUM(total_cft), 0) AS total_quick_cft, COUNT(*) AS count_quick_receipts FROM orders WHERE (order_date LIKE ? OR created_at LIKE ?) AND (bill_no LIKE 'RCP-%' OR notes LIKE '%Quick Receipt%')`,
      [monthPattern, monthPattern]
    );
    const totalQuickReceipts = parseFloat(quickData?.total_quick_receipts || 0);
    const countQuickReceipts = parseInt(quickData?.count_quick_receipts || 0, 10);

    // 3. Monthly GST Bills Total
    const [[gstData]] = await pool.query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_gst_bills, COALESCE(SUM(total_cft), 0) AS total_gst_cft, COUNT(*) AS count_gst_bills FROM orders WHERE (order_date LIKE ? OR created_at LIKE ?) AND tax_percent > 0 AND bill_no NOT LIKE 'RCP-%' AND (notes NOT LIKE '%Quick Receipt%' OR notes IS NULL)`,
      [monthPattern, monthPattern]
    );
    const totalGstBills = parseFloat(gstData?.total_gst_bills || 0);
    const countGstBills = parseInt(gstData?.count_gst_bills || 0, 10);

    // 4. Non-GST Bills
    const [[nonGstData]] = await pool.query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_non_gst_bills, COUNT(*) AS count_non_gst_bills FROM orders WHERE order_date LIKE ? AND (tax_percent = 0 OR tax_percent IS NULL) AND bill_no NOT LIKE 'RCP-%' AND (notes NOT LIKE '%Quick Receipt%' OR notes IS NULL)`,
      [monthPattern]
    );
    const totalNonGstBills = parseFloat(nonGstData?.total_non_gst_bills || 0);

    const grandCombinedTotal = totalDailyNet + totalQuickReceipts + totalGstBills;

    const [[woodCount]] = await pool.query(`SELECT COUNT(*) AS total_wood_types FROM wood_types`);
    const woodTypesCount = parseInt(woodCount?.total_wood_types || 0, 10);

    const [recentOrders] = await pool.query(
      `SELECT id, bill_no, customer_name, customer_phone, order_date, grand_total, payment_status, tax_percent FROM orders WHERE order_date LIKE ? ORDER BY id DESC LIMIT 10`,
      [monthPattern]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        month,
        daily_retail_amount: totalDailyNet,
        daily_retail_debit: totalDailyDebit,
        daily_retail_credit: totalDailyCredit,
        daily_retail_net: totalDailyNet,
        daily_retail_days: parseInt(dailyData?.days_recorded || 0, 10),
        quick_receipts_amount: totalQuickReceipts,
        quick_receipts_count: countQuickReceipts,
        gst_bills_amount: totalGstBills,
        gst_bills_count: countGstBills,
        non_gst_bills_amount: totalNonGstBills,
        total_combined_amount: grandCombinedTotal,
        wood_types_count: woodTypesCount,
        recent_orders: recentOrders
      }
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
