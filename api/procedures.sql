DELIMITER //

CREATE PROCEDURE IF NOT EXISTS PopulateTestData(IN target_device_id VARCHAR(50))
BEGIN
    DECLARE last_ts TIMESTAMP;
    DECLARE current_ts TIMESTAMP;
    DECLARE new_pulse INT;
    DECLARE last_pulse INT DEFAULT 75;
    DECLARE new_spo2 INT;
    DECLARE last_spo2 INT DEFAULT 98;
    DECLARE new_battery INT;
    DECLARE last_battery INT DEFAULT 100;
    DECLARE new_gforce FLOAT;
    
    -- Pronađi zadnji timestamp za ovaj uređaj, ako ne postoji kreni od pre 24h
    SELECT IFNULL(MAX(timestamp), DATE_SUB(NOW(), INTERVAL 24 HOUR)) INTO last_ts 
    FROM health_snapshots 
    WHERE device_id = target_device_id;
    
    SET current_ts = last_ts;
    
    -- Popunjavaj u petlji do sadašnjeg trenutka (korak 1 minut)
    WHILE current_ts < NOW() DO
        SET current_ts = DATE_ADD(current_ts, INTERVAL 1 MINUTE);
        
        -- Simuliraj realne varijacije (random šetnja)
        -- Puls: 65-85 BPM
        SET new_pulse = last_pulse + (FLOOR(RAND() * 5) - 2); -- +/- 2 BPM
        IF new_pulse < 60 THEN SET new_pulse = 65; END IF;
        IF new_pulse > 100 THEN SET new_pulse = 95; END IF;
        SET last_pulse = new_pulse;
        
        -- SpO2: 96-99%
        SET new_spo2 = 98 + (FLOOR(RAND() * 3) - 1); -- +/- 1 %
        IF new_spo2 < 95 THEN SET new_spo2 = 96; END IF;
        IF new_spo2 > 100 THEN SET new_spo2 = 100; END IF;
        SET last_spo2 = new_spo2;
        
        -- Baterija: Polako opada ili varira oko trenutne
        SET new_battery = last_battery - (IF(RAND() > 0.95, 1, 0)); -- 5% šanse da opadne za 1%
        IF new_battery < 5 THEN SET new_battery = 100; END IF; -- "Punjenje"
        SET last_battery = new_battery;
        
        -- G-Force: Mirno stanje sa malim šumom (0.95 - 1.05)
        SET new_gforce = 0.98 + (RAND() * 0.04);
        
        -- Ubaci podatak u istoriju
        INSERT INTO health_snapshots (device_id, pulse, spo2, battery, gForce, timestamp)
        VALUES (target_device_id, new_pulse, new_spo2, new_battery, new_gforce, current_ts);
        
    END WHILE;
    
    -- Ažuriraj glavni status uređaja da bi dashboard kartica bila ažurna
    UPDATE devices SET 
        pulse = last_pulse,
        spo2 = last_spo2,
        battery = last_battery,
        gForce = 1.0,
        isOnline = 1,
        source = 'Simulator',
        lastUpdated = NOW()
    WHERE device_id = target_device_id;
    
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
