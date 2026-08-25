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

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');

function get_env_val($key, $default = '') {
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    $val = getenv($key);
    if ($val !== false && $val !== '') return $val;
    return $default;
}

// Aiven MySQL Cloud configuration with automatic fallback
$host     = get_env_val('DB_HOST', 'mysql-1782bc84-priyanshupatel773-8dd.e.aivencloud.com');
$port     = get_env_val('DB_PORT', '28049');
$db_name  = get_env_val('DB_NAME', 'rk_timber_db');
$username = get_env_val('DB_USER', 'avnadmin');
$password = get_env_val('DB_PASS', base64_decode('QVZOU18yai02aTlia2pYTVplNnhVWTBz'));

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => true,
];

// Enable SSL for Aiven Cloud connection
if ($host !== 'localhost' && $host !== '127.0.0.1') {
    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
}

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (PDOException $e) {
    try {
        // Fallback to defaultdb if rk_timber_db needs initialization
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
