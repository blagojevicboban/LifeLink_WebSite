<?php
require_once 'db_config.php';

// Postavi zaglavlje za JSON odgovor
header('Content-Type: application/json');

// Proveri dolazne podatke (JSON format)
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Nevažeći JSON format"]);
    exit;
}

// === HANDLERI ZA RAZLIČITE TIPOVE PODATAKA ===

// 1. Ažuriranje zdravstvenih podataka (STATUS)
if (isset($data['device_id']) && isset($data['pulse'])) {
    $stmt = $pdo->prepare("INSERT INTO devices (device_id, name, pulse, spo2, battery, gForce, lat, lon, isOnline, source) 
                           VALUES (:id, :name, :p, :s, :b, :g, :lat, :lon, 1, :src)
                           ON DUPLICATE KEY UPDATE 
                           pulse=:p, spo2=:s, battery=:b, gForce=:g, lat=:lat, lon=:lon, isOnline=1, source=:src");
    
    $stmt->execute([
        ':id' => $data['device_id'],
        ':name' => $data['name'] ?? 'LifeLink_ESP32',
        ':p' => $data['pulse'],
        ':s' => $data['spo2'],
        ':b' => $data['battery'],
        ':g' => $data['gForce'] ?? 0,
        ':lat' => $data['lat'] ?? 0,
        ':lon' => $data['lon'] ?? 0,
        ':src' => $data['source'] ?? 'wifi'
    ]);

    // 2. Dodavanje u istoriju (snapshots) - uvek čuvaj svaki zapis
    $snapshotStmt = $pdo->prepare("INSERT INTO health_snapshots (device_id, pulse, spo2, battery, gForce, lat, lon) 
                                   VALUES (:id, :p, :s, :b, :g, :lat, :lon)");
    $snapshotStmt->execute([
        ':id' => $data['device_id'],
        ':p' => $data['pulse'],
        ':s' => $data['spo2'],
        ':b' => $data['battery'],
        ':g' => $data['gForce'] ?? 0,
        ':lat' => $data['lat'] ?? 0,
        ':lon' => $data['lon'] ?? 0
    ]);
}

// 2. Ažuriranje lokacije telefona (Poseban sync ako sat nema GPS)
if (isset($data['device_id']) && isset($data['phoneLat'])) {
    $stmt = $pdo->prepare("INSERT INTO devices (device_id, phoneLat, phoneLon, source, isOnline) 
                           VALUES (:id, :plat, :plon, 'phone_gps', 1)
                           ON DUPLICATE KEY UPDATE 
                           phoneLat=:plat, phoneLon=:plon, isOnline=1");
    $stmt->execute([
        ':id' => $data['device_id'],
        ':plat' => $data['phoneLat'],
        ':plon' => $data['phoneLon']
    ]);
}

// 3. Detekcija pada (Poseban događaj)
if (isset($data['is_fall']) && $data['is_fall'] == true) {
    $fallStmt = $pdo->prepare("INSERT INTO fall_events (device_id, gForce) VALUES (:id, :g)");
    $fallStmt->execute([
        ':id' => $data['device_id'],
        ':g' => $data['gForce'] ?? 0
    ]);
}

// 4. FCM Token (Za notifikacije)
if (isset($data['token']) && isset($data['platform'])) {
    $fcmStmt = $pdo->prepare("INSERT INTO fcm_tokens (token, platform, active) VALUES (:t, :p, 1)
                              ON DUPLICATE KEY UPDATE lastUpdated = CURRENT_TIMESTAMP, active = 1");
    $fcmStmt->execute([
        ':t' => $data['token'],
        ':p' => $data['platform']
    ]);
}

echo json_encode(["status" => "success"]);
?>
