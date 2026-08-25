<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

ini_set('display_errors', '1');
error_reporting(E_ALL);

$info = [
    "php_version" => phpversion(),
    "pdo_drivers" => class_exists('PDO') ? PDO::getAvailableDrivers() : [],
    "openssl" => extension_loaded('openssl'),
    "mysqli" => extension_loaded('mysqli'),
    "pdo_mysql" => extension_loaded('pdo_mysql'),
];

// Test connecting
try {
    $host     = 'mysql-1782bc84-priyanshupatel773-8dd.e.aivencloud.com';
    $port     = '28049';
    $db_name  = 'rk_timber_db';
    $username = 'avnadmin';
    $password = base64_decode('QVZOU18yai02aTlia2pYTVplNnhVWTBz');

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false
    ];

    $dsn = "mysql:host=$host;port=$port;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, $options);
    $info["db_status"] = "connected";

    $stmt = $pdo->query("SELECT COUNT(*) FROM wood_types");
    $info["wood_count"] = intval($stmt->fetchColumn());
} catch (Throwable $e) {
    $info["db_status"] = "error";
    $info["db_error"] = $e->getMessage();
}

echo json_encode($info);
