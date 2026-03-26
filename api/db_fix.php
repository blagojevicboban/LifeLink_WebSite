<?php
require_once 'db_config.php';
try {
    $pdo->exec("ALTER TABLE devices ADD COLUMN IF NOT EXISTS phoneLat DOUBLE AFTER source");
    $pdo->exec("ALTER TABLE devices ADD COLUMN IF NOT EXISTS phoneLon DOUBLE AFTER phoneLat");
    echo "Database updated successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
