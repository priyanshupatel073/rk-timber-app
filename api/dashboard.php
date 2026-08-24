<?php
// C:\Users\HP\Desktop\RK APP\api\dashboard.php
require_once __DIR__ . '/config/db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // Selected month filter (default to current month YYYY-MM)
        $month = isset($_GET['month']) && preg_match('/^\d{4}-\d{2}$/', trim($_GET['month']))
            ? trim($_GET['month'])
            : date('Y-m');
        
        $monthPattern = $month . '-%';

        // 1. Monthly Daily Retail Total (Both Debit / Jama & Credit / Kharch)
        $stmtDaily = $pdo->prepare("SELECT 
            COALESCE(SUM(debit_total), 0) AS total_daily_debit,
            COALESCE(SUM(credit_total), 0) AS total_daily_credit,
            COALESCE(SUM(sub_amount), 0) AS total_daily_net,
            COUNT(*) AS days_recorded
            FROM daily_retail 
            WHERE entry_date LIKE :monthPattern");
        $stmtDaily->execute([':monthPattern' => $monthPattern]);
        $dailyData = $stmtDaily->fetch() ?: ['total_daily_debit' => 0, 'total_daily_credit' => 0, 'total_daily_net' => 0, 'days_recorded' => 0];
        
        $totalDailyDebit = (float)($dailyData['total_daily_debit'] ?? 0);
        $totalDailyCredit = (float)($dailyData['total_daily_credit'] ?? 0);
        $totalDailyNet = (float)($dailyData['total_daily_net'] ?? 0);
        
        // Retail Daily Amount: Uses the exact monthly sum of SUB AMOUNT (Debit / Cash In - Credit / Cash Out)
        $totalDailyRetail = $totalDailyNet;

        // 2. Monthly Quick Receipts Total (Orders with RCP- prefix or Quick Receipt in notes)
        $stmtQuick = $pdo->prepare("SELECT 
            COALESCE(SUM(grand_total), 0) AS total_quick_receipts,
            COALESCE(SUM(total_cft), 0) AS total_quick_cft,
            COUNT(*) AS count_quick_receipts
            FROM orders 
            WHERE (order_date LIKE :monthPattern OR created_at LIKE :monthPattern) 
              AND (bill_no LIKE 'RCP-%' OR notes LIKE '%Quick Receipt%')");
        $stmtQuick->execute([':monthPattern' => $monthPattern]);
        $quickData = $stmtQuick->fetch() ?: ['total_quick_receipts' => 0, 'total_quick_cft' => 0, 'count_quick_receipts' => 0];
        $totalQuickReceipts = (float)($quickData['total_quick_receipts'] ?? 0);
        $countQuickReceipts = (int)($quickData['count_quick_receipts'] ?? 0);

        // 3. Monthly GST Bills Total (Timber Tax Invoices with tax_percent > 0, excluding quick receipts)
        $stmtGst = $pdo->prepare("SELECT 
            COALESCE(SUM(grand_total), 0) AS total_gst_bills,
            COALESCE(SUM(total_cft), 0) AS total_gst_cft,
            COUNT(*) AS count_gst_bills
            FROM orders 
            WHERE (order_date LIKE :monthPattern OR created_at LIKE :monthPattern) 
              AND tax_percent > 0 
              AND bill_no NOT LIKE 'RCP-%' 
              AND (notes NOT LIKE '%Quick Receipt%' OR notes IS NULL)");
        $stmtGst->execute([':monthPattern' => $monthPattern]);
        $gstData = $stmtGst->fetch() ?: ['total_gst_bills' => 0, 'total_gst_cft' => 0, 'count_gst_bills' => 0];
        $totalGstBills = (float)($gstData['total_gst_bills'] ?? 0);
        $countGstBills = (int)($gstData['count_gst_bills'] ?? 0);

        // Non-GST Timber Bills for additional info
        $stmtNonGst = $pdo->prepare("SELECT 
            COALESCE(SUM(grand_total), 0) AS total_non_gst_bills,
            COUNT(*) AS count_non_gst_bills
            FROM orders 
            WHERE order_date LIKE :monthPattern 
              AND (tax_percent = 0 OR tax_percent IS NULL)
              AND bill_no NOT LIKE 'RCP-%' 
              AND (notes NOT LIKE '%Quick Receipt%' OR notes IS NULL)");
        $stmtNonGst->execute([':monthPattern' => $monthPattern]);
        $nonGstData = $stmtNonGst->fetch() ?: ['total_non_gst_bills' => 0, 'count_non_gst_bills' => 0];
        $totalNonGstBills = (float)($nonGstData['total_non_gst_bills'] ?? 0);

        // 4. Combined Grand Total (Card 1 + Card 2 + Card 3 + Non-GST Bills)
        $grandCombinedTotal = $totalDailyRetail + $totalQuickReceipts + $totalGstBills;

        // Total orders count and active wood types
        $stmtWood = $pdo->query("SELECT COUNT(*) AS total_wood_types FROM wood_types");
        $woodTypesCount = (int)($stmtWood->fetchColumn() ?: 0);

        // Recent monthly activity
        $stmtRecent = $pdo->prepare("SELECT id, bill_no, customer_name, customer_phone, order_date, grand_total, payment_status, tax_percent 
            FROM orders 
            WHERE order_date LIKE :monthPattern 
            ORDER BY id DESC LIMIT 10");
        $stmtRecent->execute([':monthPattern' => $monthPattern]);
        $recentOrders = $stmtRecent->fetchAll();

        echo json_encode([
            "status" => "success",
            "data" => [
                "month" => $month,
                "daily_retail_amount" => $totalDailyRetail,
                "daily_retail_debit" => $totalDailyDebit,
                "daily_retail_credit" => $totalDailyCredit,
                "daily_retail_net" => $totalDailyNet,
                "daily_retail_days" => (int)($dailyData['days_recorded'] ?? 0),
                "quick_receipts_amount" => $totalQuickReceipts,
                "quick_receipts_count" => $countQuickReceipts,
                "gst_bills_amount" => $totalGstBills,
                "gst_bills_count" => $countGstBills,
                "non_gst_bills_amount" => $totalNonGstBills,
                "total_combined_amount" => $grandCombinedTotal,
                "wood_types_count" => $woodTypesCount,
                "recent_orders" => $recentOrders
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
