<?php
require_once 'db_config.php';

// Postavi zaglavlje za JSON odgovor
header('Content-Type: application/json');

$action = $_GET['action'] ?? 'devices';
$deviceId = $_GET['device_id'] ?? null;
$range = $_GET['range'] ?? '1h';

// Osveži isOnline status (postavi isOnline = 0 ako uređaj nije javio status više od 5 minuta)
$pdo->exec("UPDATE devices SET isOnline = 0 WHERE lastUpdated < NOW() - INTERVAL 5 MINUTE");

// === HANDLERI ZA RAZLIČITE AKCIJE ===

// 1. Spisak svih aktivnih uređaja (DASHBOARD LISTA)
if ($action === 'devices') {
    $stmt = $pdo->query("SELECT * FROM devices ORDER BY lastUpdated DESC");
    echo json_encode($stmt->fetchAll());
}

// 2. Istorija podataka za grafikone
elseif ($action === 'history' && $deviceId) {
    if ($range === '1h') {
        $interval = "INTERVAL 1 HOUR";
    } elseif ($range === 'today') {
        $interval = "INTERVAL 24 HOUR";
    } elseif ($range === '1w') {
        $interval = "INTERVAL 7 DAY";
    } elseif ($range === '1m') {
        $interval = "INTERVAL 30 DAY";
    } else {
        $interval = "INTERVAL 1 HOUR";
    }

    // Vraćamo DESC redosled jer app.js radi .reverse()
    $stmt = $pdo->prepare("SELECT * FROM health_snapshots 
                           WHERE device_id = :id AND timestamp >= DATE_SUB(NOW(), $interval) 
                           ORDER BY timestamp DESC");
    $stmt->execute([':id' => $deviceId]);
    
    echo json_encode($stmt->fetchAll());
}

// 3. Spisak padova
elseif ($action === 'falls' && $deviceId) {
    $stmt = $pdo->prepare("SELECT * FROM fall_events WHERE device_id = :id ORDER BY timestamp DESC LIMIT 3");
    $stmt->execute([':id' => $deviceId]);
    echo json_encode($stmt->fetchAll());
}

else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Nevažeća akcija ili ID uređaja"]);
}
?>
