<?php
// C:\Users\HP\Desktop\RK APP\api\upload_pdf.php
require_once __DIR__ . '/config/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

if (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "No valid PDF file uploaded"]);
    exit();
}

$uploadDir = __DIR__ . '/uploads/invoices/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$file = $_FILES['pdf_file'];
$filename = isset($_POST['filename']) && !empty(trim($_POST['filename'])) 
    ? preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', trim($_POST['filename']))
    : 'Invoice_' . date('Ymd_His') . '.pdf';

if (!str_ends_with(strtolower($filename), '.pdf')) {
    $filename .= '.pdf';
}

$targetPath = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $fileUrl = $protocol . $host . '/api/uploads/invoices/' . $filename;

    echo json_encode([
        "status" => "success",
        "message" => "PDF uploaded successfully",
        "data" => [
            "filename" => $filename,
            "url" => $fileUrl
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to save PDF on server"]);
}
