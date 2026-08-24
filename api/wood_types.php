<?php
// C:\Users\HP\Desktop\RK APP\api\wood_types.php
require_once __DIR__ . '/config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM wood_types ORDER BY name ASC");
        $woodTypes = $stmt->fetchAll();
        echo json_encode([
            "status" => "success",
            "data" => $woodTypes
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    if (!isset($input['name']) || !isset($input['default_rate_per_cft'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Name and rate per CFT are required"]);
        exit();
    }

    try {
        $name = trim($input['name']);
        $rate = floatval($input['default_rate_per_cft']);
        $category = isset($input['category']) && !empty(trim($input['category'])) ? trim($input['category']) : 'General Wood';

        // Upsert by wood name
        $checkStmt = $pdo->prepare("SELECT id FROM wood_types WHERE name = :name LIMIT 1");
        $checkStmt->execute([':name' => $name]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            $updateStmt = $pdo->prepare("UPDATE wood_types SET default_rate_per_cft = :rate, category = :category WHERE id = :id");
            $updateStmt->execute([
                ':rate' => $rate,
                ':category' => $category,
                ':id' => $existing['id']
            ]);
            $woodId = $existing['id'];
            $msg = "Wood rate updated successfully";
        } else {
            $stmt = $pdo->prepare("INSERT INTO wood_types (name, default_rate_per_cft, category) VALUES (:name, :rate, :category)");
            $stmt->execute([
                ':name' => $name,
                ':rate' => $rate,
                ':category' => $category
            ]);
            $woodId = $pdo->lastInsertId();
            $msg = "Wood type added successfully";
        }

        echo json_encode([
            "status" => "success",
            "message" => $msg,
            "id" => intval($woodId),
            "data" => [
                "id" => intval($woodId),
                "name" => $name,
                "default_rate_per_cft" => $rate,
                "category" => $category
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Wood type ID is required"]);
        exit();
    }
    try {
        $id = intval($_GET['id']);
        $stmt = $pdo->prepare("DELETE FROM wood_types WHERE id = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(["status" => "success", "message" => "Wood type removed successfully"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
