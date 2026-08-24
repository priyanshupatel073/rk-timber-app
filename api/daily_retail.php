<?php
// C:\Users\HP\Desktop\RK APP\api\daily_retail.php
require_once __DIR__ . '/config/db.php';

// Auto create daily_retail table if not already created
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `daily_retail` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `entry_date` DATE NOT NULL UNIQUE,
      `debit_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `credit_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `sub_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `debit_entries` LONGTEXT DEFAULT NULL,
      `credit_entries` LONGTEXT DEFAULT NULL,
      `notes` TEXT DEFAULT NULL,
      `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (PDOException $e) {
    // Table creation error handled gracefully
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        if (isset($_GET['date'])) {
            $date = $_GET['date'];
            $stmt = $pdo->prepare("SELECT * FROM daily_retail WHERE entry_date = :entry_date LIMIT 1");
            $stmt->execute([':entry_date' => $date]);
            $row = $stmt->fetch();

            if ($row) {
                $row['debit_entries'] = json_decode($row['debit_entries'] ?: '[]', true) ?: [];
                $row['credit_entries'] = json_decode($row['credit_entries'] ?: '[]', true) ?: [];
                echo json_encode(["status" => "success", "data" => $row]);
            } else {
                echo json_encode(["status" => "success", "data" => null]);
            }
        } elseif (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $stmt = $pdo->prepare("SELECT * FROM daily_retail WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();

            if ($row) {
                $row['debit_entries'] = json_decode($row['debit_entries'] ?: '[]', true) ?: [];
                $row['credit_entries'] = json_decode($row['credit_entries'] ?: '[]', true) ?: [];
                echo json_encode(["status" => "success", "data" => $row]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Record not found"]);
            }
        } else {
            // Fetch all entries sorted by entry_date descending
            $stmt = $pdo->query("SELECT * FROM daily_retail ORDER BY entry_date DESC");
            $rows = $stmt->fetchAll();

            foreach ($rows as &$r) {
                $r['debit_entries'] = json_decode($r['debit_entries'] ?: '[]', true) ?: [];
                $r['credit_entries'] = json_decode($r['credit_entries'] ?: '[]', true) ?: [];
            }

            echo json_encode(["status" => "success", "data" => $rows]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} elseif ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['entry_date'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Valid entry_date is required."]);
        exit();
    }

    try {
        $entry_date = $input['entry_date'];
        $debit_total = floatval($input['debit_total'] ?? 0);
        $credit_total = floatval($input['credit_total'] ?? 0);
        $sub_amount = floatval($input['sub_amount'] ?? ($debit_total - $credit_total));
        $debit_entries = is_array($input['debit_entries'] ?? null) ? json_encode($input['debit_entries']) : '[]';
        $credit_entries = is_array($input['credit_entries'] ?? null) ? json_encode($input['credit_entries']) : '[]';
        $notes = $input['notes'] ?? '';

        // Check if entry for this date already exists
        $checkStmt = $pdo->prepare("SELECT id FROM daily_retail WHERE entry_date = :entry_date LIMIT 1");
        $checkStmt->execute([':entry_date' => $entry_date]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            $updateStmt = $pdo->prepare("UPDATE daily_retail SET
                debit_total = :debit_total,
                credit_total = :credit_total,
                sub_amount = :sub_amount,
                debit_entries = :debit_entries,
                credit_entries = :credit_entries,
                notes = :notes,
                updated_at = NOW()
                WHERE id = :id");
            $updateStmt->execute([
                ':debit_total' => $debit_total,
                ':credit_total' => $credit_total,
                ':sub_amount' => $sub_amount,
                ':debit_entries' => $debit_entries,
                ':credit_entries' => $credit_entries,
                ':notes' => $notes,
                ':id' => $existing['id']
            ]);
            $recordId = $existing['id'];
        } else {
            $insertStmt = $pdo->prepare("INSERT INTO daily_retail 
                (entry_date, debit_total, credit_total, sub_amount, debit_entries, credit_entries, notes)
                VALUES (:entry_date, :debit_total, :credit_total, :sub_amount, :debit_entries, :credit_entries, :notes)");
            $insertStmt->execute([
                ':entry_date' => $entry_date,
                ':debit_total' => $debit_total,
                ':credit_total' => $credit_total,
                ':sub_amount' => $sub_amount,
                ':debit_entries' => $debit_entries,
                ':credit_entries' => $credit_entries,
                ':notes' => $notes
            ]);
            $recordId = $pdo->lastInsertId();
        }

        echo json_encode([
            "status" => "success",
            "message" => "Daily retail ledger for $entry_date saved successfully.",
            "data" => [
                "id" => $recordId,
                "entry_date" => $entry_date,
                "debit_total" => $debit_total,
                "credit_total" => $credit_total,
                "sub_amount" => $sub_amount
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    try {
        if (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $stmt = $pdo->prepare("DELETE FROM daily_retail WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(["status" => "success", "message" => "Daily retail entry deleted."]);
        } elseif (isset($_GET['date'])) {
            $date = $_GET['date'];
            $stmt = $pdo->prepare("DELETE FROM daily_retail WHERE entry_date = :entry_date");
            $stmt->execute([':entry_date' => $date]);
            echo json_encode(["status" => "success", "message" => "Daily retail entry for $date deleted."]);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID or Date is required for delete."]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed."]);
}
