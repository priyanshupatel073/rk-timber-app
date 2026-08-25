<?php
// C:\Users\HP\Desktop\RK APP\api\config\db.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Read database connection settings from Environment Variables (Vercel / Cloud) with localhost fallback (XAMPP)
$host     = getenv('DB_HOST') ?: 'localhost';
$port     = getenv('DB_PORT') ?: '3306';
$db_name  = getenv('DB_NAME') ?: 'rk_timber_db';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => true,
];

// Enable SSL when connecting to Aiven / Remote Cloud MySQL
if ($host !== 'localhost' && $host !== '127.0.0.1') {
    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
}

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (PDOException $e) {
    // If rk_timber_db database doesn't exist yet on local/cloud, try creating/initializing
    try {
        $dsnFallback = "mysql:host=$host;port=$port;dbname=defaultdb;charset=utf8mb4";
        $pdo = new PDO($dsnFallback, $username, $password, $options);
        
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db_name` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$db_name`");

        $schemaFile = __DIR__ . '/../../database/schema.sql';
        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            $pdo->exec($sql);
        }
    } catch (PDOException $ex) {
        http_response_code(500);
        echo json_encode([
            "status"  => "error",
            "message" => "Database connection failed: " . $ex->getMessage()
        ]);
        exit();
    }
}
