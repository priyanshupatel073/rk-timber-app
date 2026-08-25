<?php
// C:\Users\HP\Desktop\RK APP\api\orders.php
require_once __DIR__ . '/config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        // Fetch single order details with items
        try {
            $orderId = intval($_GET['id']);
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
            $stmt->execute([':id' => $orderId]);
            $order = $stmt->fetch();

            if (!$order) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Order not found"]);
                exit();
            }

            $itemsStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC");
            $itemsStmt->execute([':order_id' => $orderId]);
            $order['items'] = $itemsStmt->fetchAll();

            echo json_encode(["status" => "success", "data" => $order]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
    } elseif (isset($_GET['stats'])) {
        // Fetch live dashboard analytics and aggregated metrics
        try {
            $today = date('Y-m-d');

            // Today's Sales & Orders
            $stmtToday = $pdo->prepare("SELECT 
                COALESCE(SUM(grand_total), 0) AS today_sales,
                COUNT(*) AS today_orders_count,
                COALESCE(SUM(total_cft), 0) AS today_cft
                FROM orders WHERE order_date = :today");
            $stmtToday->execute([':today' => $today]);
            $todayMetrics = $stmtToday->fetch();

            // Overall Volume & Totals
            $stmtAll = $pdo->query("SELECT 
                COALESCE(SUM(grand_total), 0) AS total_revenue,
                COUNT(*) AS total_orders_count,
                COALESCE(SUM(total_cft), 0) AS total_cft_all
                FROM orders");
            $allMetrics = $stmtAll->fetch();

            // Pending Customer Dues
            $stmtPending = $pdo->query("SELECT 
                COALESCE(SUM(grand_total), 0) AS pending_balance,
                COUNT(*) AS pending_count
                FROM orders WHERE payment_status IN ('Pending', 'Partial')");
            $pendingMetrics = $stmtPending->fetch();

            // Wood Types Count
            $stmtWoodCount = $pdo->query("SELECT COUNT(*) AS wood_types_count FROM wood_types");
            $woodCount = $stmtWoodCount->fetchColumn();

            // Recent 10 Orders with items metadata
            $stmtRecent = $pdo->query("SELECT 
                o.*,
                (SELECT COALESCE(SUM(pcs), 0) FROM order_items WHERE order_id = o.id) AS total_pcs,
                (SELECT wood_type FROM order_items WHERE order_id = o.id LIMIT 1) AS primary_wood
                FROM orders o
                ORDER BY o.id DESC LIMIT 10");
            $recentOrders = $stmtRecent->fetchAll();

            echo json_encode([
                "status" => "success",
                "data" => [
                    "today_sales" => floatval($todayMetrics['today_sales']),
                    "today_orders_count" => intval($todayMetrics['today_orders_count']),
                    "today_cft" => floatval($todayMetrics['today_cft']),
                    "total_revenue" => floatval($allMetrics['total_revenue']),
                    "total_orders_count" => intval($allMetrics['total_orders_count']),
                    "total_cft_all" => floatval($allMetrics['total_cft_all']),
                    "pending_balance" => floatval($pendingMetrics['pending_balance']),
                    "pending_count" => intval($pendingMetrics['pending_count']),
                    "wood_types_count" => intval($woodCount),
                    "recent_orders" => $recentOrders
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
    } else {
        // Fetch order list with search filter
        try {
            $search = isset($_GET['search']) && trim($_GET['search']) !== '' ? '%' . trim($_GET['search']) . '%' : null;
            
            if ($search !== null) {
                $stmt = $pdo->prepare("SELECT 
                    o.*,
                    (SELECT COALESCE(SUM(pcs), 0) FROM order_items WHERE order_id = o.id) AS total_pcs,
                    (SELECT wood_type FROM order_items WHERE order_id = o.id LIMIT 1) AS primary_wood
                    FROM orders o 
                    WHERE o.customer_name LIKE :search1 
                       OR o.customer_phone LIKE :search2 
                       OR o.bill_no LIKE :search3 
                    ORDER BY o.id DESC LIMIT 100");
                $stmt->execute([
                    ':search1' => $search,
                    ':search2' => $search,
                    ':search3' => $search
                ]);
            } else {
                $stmt = $pdo->query("SELECT 
                    o.*,
                    (SELECT COALESCE(SUM(pcs), 0) FROM order_items WHERE order_id = o.id) AS total_pcs,
                    (SELECT wood_type FROM order_items WHERE order_id = o.id LIMIT 1) AS primary_wood
                    FROM orders o 
                    ORDER BY o.id DESC LIMIT 100");
            }
            
            $orders = $stmt->fetchAll();
            if (count($orders) > 0) {
                $orderIds = array_column($orders, 'id');
                $inQuery = implode(',', array_map('intval', $orderIds));
                if (!empty($inQuery)) {
                    $itemsStmt = $pdo->query("SELECT * FROM order_items WHERE order_id IN ($inQuery) ORDER BY id ASC");
                    $allItems = $itemsStmt->fetchAll();
                    
                    $itemsByOrder = [];
                    foreach ($allItems as $item) {
                        $itemsByOrder[$item['order_id']][] = $item;
                    }
                    
                    foreach ($orders as &$ord) {
                        $ord['items'] = $itemsByOrder[$ord['id']] ?? [];
                    }
                    unset($ord);
                }
            }
            echo json_encode(["status" => "success", "data" => $orders]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
    }
} elseif ($method === 'POST' || $method === 'PATCH' || $method === 'PUT') {
    $input = json_decode(file_get_contents("php://input"), true);

    // Fast-path: Quick status update directly from table entries
    if (
        (isset($input['action']) && $input['action'] === 'update_status') ||
        (isset($input['payment_status']) && (isset($input['id']) || isset($input['bill_no'])) && (!isset($input['items']) || !is_array($input['items'])))
    ) {
        $orderId = isset($input['id']) && intval($input['id']) > 0 ? intval($input['id']) : null;
        $billNo = isset($input['bill_no']) && !empty(trim($input['bill_no'])) ? trim($input['bill_no']) : null;
        $status = isset($input['payment_status']) ? trim($input['payment_status']) : 'Paid';

        if (!$orderId && !$billNo) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Order ID or Bill No is required for status update"]);
            exit();
        }

        try {
            // Ensure column can store varchar values without enum restriction
            try {
                $pdo->exec("ALTER TABLE `orders` MODIFY COLUMN `payment_status` VARCHAR(50) DEFAULT 'Paid'");
            } catch (Exception $eCol) { }

            $updated = false;
            if ($orderId && $orderId < 10000000000) {
                $stmt = $pdo->prepare("UPDATE orders SET payment_status = :status WHERE id = :id");
                $stmt->execute([':status' => $status, ':id' => $orderId]);
                if ($stmt->rowCount() > 0) $updated = true;
            }
            if (!$updated && $billNo) {
                $stmt = $pdo->prepare("UPDATE orders SET payment_status = :status WHERE bill_no = :bill_no");
                $stmt->execute([':status' => $status, ':bill_no' => $billNo]);
                if ($stmt->rowCount() > 0) $updated = true;
            }

            echo json_encode([
                "status" => "success",
                "message" => "Payment status updated to " . $status,
                "data" => [
                    "id" => $orderId,
                    "bill_no" => $billNo,
                    "payment_status" => $status
                ]
            ]);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Status update error: " . $e->getMessage()]);
            exit();
        }
    }
    
    // Save new order / bill
    if (!isset($input['customer_name']) || empty(trim($input['customer_name']))) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Customer name is required"]);
        exit();
    }

    if (!isset($input['items']) || !is_array($input['items']) || count($input['items']) === 0) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "At least one timber size line item is required"]);
        exit();
    }

    try {
        $pdo->beginTransaction();

        $customerName = trim($input['customer_name']);
        $customerPhone = isset($input['customer_phone']) ? trim($input['customer_phone']) : '';
        $customerAddress = isset($input['customer_address']) ? trim($input['customer_address']) : '';
        $orderDate = isset($input['order_date']) && !empty($input['order_date']) ? $input['order_date'] : date('Y-m-d');
        
        $cuttingCharges = floatval($input['cutting_charges'] ?? 0);
        $transportCharges = floatval($input['transport_charges'] ?? 0);
        $taxPercent = floatval($input['tax_percent'] ?? 0);
        $discount = floatval($input['discount'] ?? 0);
        $notes = isset($input['notes']) ? trim($input['notes']) : '';
        $paymentStatus = isset($input['payment_status']) ? $input['payment_status'] : 'Paid';

        // Calculate totals across items
        $totalCft = 0.00;
        $subtotal = 0.00;
        $itemsData = [];

        foreach ($input['items'] as $item) {
            $woodType = isset($item['wood_type']) && !empty(trim($item['wood_type'])) ? trim($item['wood_type']) : 'General Wood';
            $lengthFt = floatval($item['length_ft'] ?? 0);
            $widthIn = floatval($item['width_in'] ?? 0);
            $thicknessIn = floatval($item['thickness_in'] ?? 0);
            $pcs = intval($item['pcs'] ?? 1);
            $ratePerCft = floatval($item['rate_per_cft'] ?? 0);

            $cftPerPc = ($lengthFt * $widthIn * $thicknessIn > 0) ? ($lengthFt * $widthIn * $thicknessIn) / 144 : 0;
            $itemTotalCft = $cftPerPc * $pcs;
            $itemTotalAmount = $itemTotalCft * $ratePerCft;

            $totalCft += $itemTotalCft;
            $subtotal += $itemTotalAmount;

            $itemsData[] = [
                'wood_type' => $woodType,
                'length_ft' => $lengthFt,
                'width_in' => $widthIn,
                'thickness_in' => $thicknessIn,
                'pcs' => $pcs,
                'cft_per_pc' => round($cftPerPc, 4),
                'total_cft' => round($itemTotalCft, 4),
                'rate_per_cft' => round($ratePerCft, 2),
                'total_amount' => round($itemTotalAmount, 2)
            ];
        }

        $taxAmount = ($subtotal * $taxPercent) / 100;
        $grandTotal = max(0, $subtotal + $cuttingCharges + $transportCharges + $taxAmount - $discount);

        $existingOrderId = isset($input['id']) && intval($input['id']) > 0 ? intval($input['id']) : null;
        $orderExists = false;

        if ($existingOrderId) {
            $checkStmt = $pdo->prepare("SELECT id FROM orders WHERE id = :id");
            $checkStmt->execute([':id' => $existingOrderId]);
            if ($checkStmt->fetch()) {
                $orderExists = true;
            }
        }

        // Also check by bill_no if provided
        if (!$orderExists && isset($input['bill_no']) && !empty(trim($input['bill_no']))) {
            $checkBillStmt = $pdo->prepare("SELECT id FROM orders WHERE bill_no = :bill_no");
            $checkBillStmt->execute([':bill_no' => trim($input['bill_no'])]);
            $foundOrder = $checkBillStmt->fetch();
            if ($foundOrder) {
                $orderExists = true;
                $existingOrderId = $foundOrder['id'];
            }
        }

        if ($orderExists && $existingOrderId) {
            // Update existing order
            $orderId = $existingOrderId;
            $billNo = isset($input['bill_no']) && !empty(trim($input['bill_no'])) ? trim($input['bill_no']) : 'RK-' . date('Ymd') . '-' . $existingOrderId;

            $stmtUpdate = $pdo->prepare("UPDATE orders SET 
                bill_no = :bill_no, customer_name = :c_name, customer_phone = :c_phone, customer_address = :c_addr, 
                order_date = :o_date, total_cft = :t_cft, subtotal = :subtotal, cutting_charges = :cutting, 
                transport_charges = :transport, tax_percent = :tax, discount = :discount, grand_total = :grand_total, 
                notes = :notes, payment_status = :pay_status WHERE id = :id");

            $stmtUpdate->execute([
                ':bill_no' => $billNo,
                ':c_name' => $customerName,
                ':c_phone' => $customerPhone,
                ':c_addr' => $customerAddress,
                ':o_date' => $orderDate,
                ':t_cft' => round($totalCft, 3),
                ':subtotal' => round($subtotal, 2),
                ':cutting' => round($cuttingCharges, 2),
                ':transport' => round($transportCharges, 2),
                ':tax' => round($taxPercent, 2),
                ':discount' => round($discount, 2),
                ':grand_total' => round($grandTotal, 2),
                ':notes' => $notes,
                ':pay_status' => $paymentStatus,
                ':id' => $orderId
            ]);

            // Clear old items to replace with updated items
            $pdo->prepare("DELETE FROM order_items WHERE order_id = :order_id")->execute([':order_id' => $orderId]);
        } else {
            // New Order Insert
            $billNo = isset($input['bill_no']) && !empty(trim($input['bill_no'])) 
                ? trim($input['bill_no']) 
                : 'RK-' . date('Ymd') . '-' . rand(1000, 9999);

            // Ensure bill_no uniqueness
            $checkStmt = $pdo->prepare("SELECT id FROM orders WHERE bill_no = :bill_no");
            $checkStmt->execute([':bill_no' => $billNo]);
            if ($checkStmt->fetch()) {
                $billNo = 'RK-' . date('Ymd') . '-' . rand(1000, 9999);
            }

            // Insert into orders table
            $stmtOrder = $pdo->prepare("INSERT INTO orders 
                (bill_no, customer_name, customer_phone, customer_address, order_date, total_cft, subtotal, cutting_charges, transport_charges, tax_percent, discount, grand_total, notes, payment_status) 
                VALUES (:bill_no, :c_name, :c_phone, :c_addr, :o_date, :t_cft, :subtotal, :cutting, :transport, :tax, :discount, :grand_total, :notes, :pay_status)");
            
            $stmtOrder->execute([
                ':bill_no' => $billNo,
                ':c_name' => $customerName,
                ':c_phone' => $customerPhone,
                ':c_addr' => $customerAddress,
                ':o_date' => $orderDate,
                ':t_cft' => round($totalCft, 3),
                ':subtotal' => round($subtotal, 2),
                ':cutting' => round($cuttingCharges, 2),
                ':transport' => round($transportCharges, 2),
                ':tax' => round($taxPercent, 2),
                ':discount' => round($discount, 2),
                ':grand_total' => round($grandTotal, 2),
                ':notes' => $notes,
                ':pay_status' => $paymentStatus
            ]);

            $orderId = $pdo->lastInsertId();
        }

        // Insert order items
        $stmtItem = $pdo->prepare("INSERT INTO order_items 
            (order_id, wood_type, length_ft, width_in, thickness_in, pcs, cft_per_pc, total_cft, rate_per_cft, total_amount) 
            VALUES (:order_id, :wood_type, :length_ft, :width_in, :thickness_in, :pcs, :cft_per_pc, :total_cft, :rate_per_cft, :total_amount)");

        foreach ($itemsData as $item) {
            $stmtItem->execute([
                ':order_id' => $orderId,
                ':wood_type' => $item['wood_type'],
                ':length_ft' => $item['length_ft'],
                ':width_in' => $item['width_in'],
                ':thickness_in' => $item['thickness_in'],
                ':pcs' => $item['pcs'],
                ':cft_per_pc' => $item['cft_per_pc'],
                ':total_cft' => $item['total_cft'],
                ':rate_per_cft' => $item['rate_per_cft'],
                ':total_amount' => $item['total_amount']
            ]);
        }

        // Save customer record
        if (!empty($customerName)) {
            $stmtCust = $pdo->prepare("SELECT id FROM customers WHERE name = :cname LIMIT 1");
            $stmtCust->execute([':cname' => $customerName]);
            if (!$stmtCust->fetch()) {
                $stmtNewCust = $pdo->prepare("INSERT INTO customers (name, phone, address) VALUES (:name, :phone, :address)");
                $stmtNewCust->execute([
                    ':name' => $customerName,
                    ':phone' => $customerPhone,
                    ':address' => $customerAddress
                ]);
            }
        }

        $pdo->commit();

        echo json_encode([
            "status" => "success",
            "message" => "Order saved successfully",
            "data" => [
                "id" => intval($orderId),
                "bill_no" => $billNo,
                "customer_name" => $customerName,
                "order_date" => $orderDate,
                "grand_total" => round($grandTotal, 2),
                "subtotal" => round($subtotal, 2),
                "total_cft" => round($totalCft, 3),
                "payment_status" => $paymentStatus
            ]
        ]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Failed to save order: " . $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    // Delete order by ID
    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Order ID is required"]);
        exit();
    }
    try {
        $orderId = intval($_GET['id']);
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = :id");
        $stmt->execute([':id' => $orderId]);
        echo json_encode(["status" => "success", "message" => "Order deleted successfully"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
