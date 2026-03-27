DELIMITER //

CREATE PROCEDURE IF NOT EXISTS PopulateTestData(IN target_device_id VARCHAR(50) CHARACTER SET utf8mb4)
BEGIN
    DECLARE last_lat DOUBLE DEFAULT 43.1557;
    DECLARE last_lon DOUBLE DEFAULT 22.5857;
    DECLARE last_pulse INT DEFAULT 75;
    DECLARE last_spo2 INT DEFAULT 98;
    DECLARE last_battery INT DEFAULT 100;
    DECLARE last_ts TIMESTAMP;
    
    DECLARE current_ts TIMESTAMP;
    DECLARE new_lat DOUBLE;
    DECLARE new_lon DOUBLE;
    DECLARE new_pulse INT;
    DECLARE new_spo2 INT;
    DECLARE new_battery INT;
    DECLARE new_gforce DOUBLE;
    
    -- Pronađi zadnji timestamp za ovaj uređaj, ako ne postoji kreni od pre 30 DANA
    SELECT IFNULL(MAX(timestamp), DATE_SUB(NOW(), INTERVAL 30 DAY)) INTO last_ts 
    FROM health_snapshots 
    WHERE device_id = target_device_id COLLATE utf8mb4_unicode_ci;

    -- Pokušaj da preuzmeš poslednju lokaciju i vitalne parametre
    SELECT 
        IFNULL(lat, 43.1557), 
        IFNULL(lon, 22.5857),
        IFNULL(pulse, 75),
        IFNULL(spo2, 98),
        IFNULL(battery, 100)
    INTO last_lat, last_lon, last_pulse, last_spo2, last_battery
    FROM health_snapshots 
    WHERE device_id = target_device_id COLLATE utf8mb4_unicode_ci 
    ORDER BY timestamp DESC LIMIT 1;
    
    SET current_ts = last_ts;
    
    -- Popunjavaj u petlji do sadašnjeg trenutka (korak 1 minut)
    WHILE current_ts < NOW() DO
        SET current_ts = DATE_ADD(current_ts, INTERVAL 1 MINUTE);
        
        -- Simuliraj realne varijacije (random šetnja)
        SET new_pulse = last_pulse + (FLOOR(RAND() * 5) - 2); 
        IF new_pulse < 60 THEN SET new_pulse = 65; END IF;
        IF new_pulse > 100 THEN SET new_pulse = 95; END IF;
        SET last_pulse = new_pulse;
        
        SET new_spo2 = 98 + (FLOOR(RAND() * 3) - 1); 
        IF new_spo2 < 95 THEN SET new_spo2 = 96; END IF;
        IF new_spo2 > 100 THEN SET new_spo2 = 100; END IF;
        SET last_spo2 = new_spo2;
        
        SET new_battery = last_battery - (IF(RAND() > 0.95, 1, 0)); 
        IF new_battery < 5 THEN SET new_battery = 100; END IF; 
        SET last_battery = new_battery;
        
        SET new_gforce = 0.98 + (RAND() * 0.04);

        -- Lokacija (Pirot) - Simulacija hodanja (nepristrasna)
        SET new_lat = last_lat + (RAND() - 0.5) * 0.0001; 
        SET new_lon = last_lon + (RAND() - 0.5) * 0.0001;
        SET last_lat = new_lat;
        SET last_lon = new_lon;
        
        INSERT INTO health_snapshots (device_id, pulse, spo2, battery, gForce, lat, lon, timestamp)
        VALUES (target_device_id, new_pulse, new_spo2, new_battery, new_gforce, new_lat, new_lon, current_ts);
        
    END WHILE;
    
    -- Ažuriraj glavni status uređaja
    UPDATE devices SET 
        pulse = last_pulse,
        spo2 = last_spo2,
        battery = last_battery,
        gForce = 1.0,
        lat = last_lat,
        lon = last_lon,
        isOnline = 1,
        source = 'Simulator',
        lastUpdated = NOW()
    WHERE device_id = target_device_id COLLATE utf8mb4_unicode_ci;
    
END //

DELIMITER ;

-- Pozivanje procedure za test_device (Ručno):
-- CALL PopulateTestData('test_device');

-- AUTOMATIZACIJA (MariaDB Event):
-- Proveri da li je event_scheduler uključen: SET GLOBAL event_scheduler = ON;
CREATE EVENT IF NOT EXISTS AutoSeed_Test_Device
ON SCHEDULE EVERY 5 MINUTE
DO 
  CALL PopulateTestData('test_device');

