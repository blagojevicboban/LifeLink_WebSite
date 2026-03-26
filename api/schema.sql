CREATE DATABASE IF NOT EXISTS lifelink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lifelink;

-- Tabela za trenutne statuse uređaja (Dashboard)
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    pulse INT,
    spo2 INT,
    battery INT,
    gForce FLOAT,
    lat DOUBLE,
    lon DOUBLE,
    isOnline TINYINT(1) DEFAULT 0,
    source VARCHAR(20),
    phoneLat DOUBLE,
    phoneLon DOUBLE,
    lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela za istoriju zdravlja (Grafikoni)
CREATE TABLE IF NOT EXISTS health_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50),
    pulse INT,
    spo2 INT,
    battery INT,
    gForce FLOAT,
    lat DOUBLE,
    lon DOUBLE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (device_id),
    INDEX (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela za padove
CREATE TABLE IF NOT EXISTS fall_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50),
    gForce FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela za FCM (Notifikacije)
CREATE TABLE IF NOT EXISTS fcm_tokens (
    token VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(20),
    lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

