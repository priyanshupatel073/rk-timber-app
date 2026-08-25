<?php
// C:\Users\HP\Desktop\RK APP\api\calculate.php
require_once __DIR__ . '/config/db.php';

$input = json_decode(file_get_contents("php://input"), true);
$items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];

$processedItems = [];
$grandTotalCft = 0.00;
$subtotalAmount = 0.00;

foreach ($items as $item) {
    $lengthFt = floatval($item['length_ft'] ?? 0);
    $widthIn = floatval($item['width_in'] ?? 0);
    $thicknessIn = floatval($item['thickness_in'] ?? 0);
    $pcs = intval($item['pcs'] ?? 1);
    $ratePerCft = floatval($item['rate_per_cft'] ?? 0);
    $woodType = trim($item['wood_type'] ?? 'Standard Timber');

    // Standard CFT formula: (Length in Ft * Width in Inches * Thickness in Inches) / 144
    $cftPerPc = ($lengthFt * $widthIn * $thicknessIn > 0) ? ($lengthFt * $widthIn * $thicknessIn) / 144 : 0;
    $totalCft = $cftPerPc * $pcs;
    $totalAmount = $totalCft * $ratePerCft;

    $grandTotalCft += $totalCft;
    $subtotalAmount += $totalAmount;

    $processedItems[] = [
        "wood_type" => $woodType,
        "length_ft" => $lengthFt,
        "width_in" => $widthIn,
        "thickness_in" => $thicknessIn,
        "pcs" => $pcs,
        "cft_per_pc" => round($cftPerPc, 4),
        "total_cft" => round($totalCft, 4),
        "rate_per_cft" => round($ratePerCft, 2),
        "total_amount" => round($totalAmount, 2)
    ];
}

echo json_encode([
    "status" => "success",
    "data" => [
        "items" => $processedItems,
        "total_cft" => round($grandTotalCft, 3),
        "subtotal" => round($subtotalAmount, 2)
    ]
]);
