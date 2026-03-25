<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Debug Konekcije</h1>";

if (!file_exists('db_config.php')) {
    die("GREŠKA: db_config.php ne postoji u api/ folderu na serveru!");
}

require_once 'db_config.php';

echo "Pokušaj povezivanja na: $host...<br>";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "<b style='color:green'>USPEH: Konekcija sa bazom je uspostavljena!</b>";
} catch (PDOException $e) {
    echo "<b style='color:red'>GREŠKA PRI POVEZIVANJU:</b> " . $e->getMessage();
}
?>
