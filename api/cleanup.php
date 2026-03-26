<?php
// LifeLink Database Cleanup
// Ovaj fajl sluzi za uklanjanje testnih podataka nakon migracije
require_once 'db_config.php';

header('Content-Type: text/html; charset=utf-8');

try {
    // 1. Obrisi testne uredjaje
    $stmt1 = $pdo->prepare("DELETE FROM devices WHERE device_id IN ('manual_test', 'test_device')");
    $stmt1->execute();
    $deletedDevices = $stmt1->rowCount();

    // 2. Obrisi istoriju za te uredjaje
    $stmt2 = $pdo->prepare("DELETE FROM health_snapshots WHERE device_id IN ('manual_test', 'test_device')");
    $stmt2->execute();
    $deletedSnapshots = $stmt2->rowCount();

    echo "<h1>Uspeh!</h1>";
    echo "<p>Obrisano uređaja: <strong>$deletedDevices</strong></p>";
    echo "<p>Obrisano zapisa istorije: <strong>$deletedSnapshots</strong></p>";
    echo "<p><strong>Dashboard bi sada trebalo da bude prazan dok se ne poveže vaš pravi sat i pošalje prve podatke na 'update.php'.</strong></p>";
    echo "<br><a href='../dashboard/index.html'>Nazad na Dashboard</a>";

} catch (Exception $e) {
    echo "<h1>Greška pri čišćenju:</h1>";
    echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
}
?>
