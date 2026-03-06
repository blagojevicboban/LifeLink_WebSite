# Technical Documentation - LifeLink [ESP32-S3]

This document describes the internal functioning of the LifeLink smart health-safety bracelet, covering sensor structure, network stacks, I2C communication, and asynchronous task management in FreeRTOS.

## System Architecture & Resource Management (FreeRTOS)

At the heart of LifeLink is the powerful dual-core `ESP32-S3` controller. Operations are divided using built-in FreeRTOS to maintain a fluid user interface at high frame rates while background tasks perform critical body scanning for the most vulnerable patients and elderly users.

**Core/Task Distribution:**
- `app_main`: Dedesignated for bottom-level processing and the main LVGL interface (Screen, GUI), communicating with the LCD controller via DMA SPI channels.
- `sensor_read_task` (Higher priority, Core 1): Synchronizes with the `QMI8658` over `I2C`.
- `MAX30102`: C-based drivers implemented as asynchronous interrupts where the sensor packs data through a `FIFO` buffer and then forwards the matrix to the FFT operation.
- `gsm_task`: The GSM modem runs on a separate task and exclusively listens to `UART` in a non-blocking manner to avoid UI interference if the connection with the carrier drops.
- `ble_spp_server_task`: The Bluetooth channel is responsible for sending "Heartbeat" (Telemetry) logs every second and receives high-priority interrupts.

### Hardware Interrupts & I2C (Known Issues)

Due to the tight-loop nature in sensor applications where `MAX30102` constantly writes optical data to `I2C`, alongside the touch controller.

*Note for implementers:*
The known "Interrupt Watchdog (WDT)" module crash can occur when Bluetooth (`bt_controller_task`) causes ISR overlaps due to excessive priority and poor organization of the older `driver/i2c` library in ESP-IDF v5.x. This is resolved by using the newer `driver/i2c_master.h` iteration and introducing Mutex/Semaphores for hardware resource sharing or pausing sensor-heavy tasks.

## Fall Detection Logic (QMI8658 Advanced Logic)

Fall detection is divided into 3 state-machine phases that ignore false movements. The algorithm doesn't react solely to G-force thresholds (`< 0.6G for Fall, > 3.5G for Impact`), but rather:
1. `FREE_FALL`: The system detects a total loss of gravity (0 - 0.6G) with periodic monitoring. It stores reference data before the drop for later orientation calculation.
2. `IMPACT_DETECTED`: Triggered once G-force exceeds the defined threshold (> 3.5G). If not met within 500ms, the state machine resets.
3. `STILLNESS & ANGLE CHECK`: A fall must conclude with a `STILLNESS` condition for at least 5 seconds, followed by calculating the Dot-Product angle between the initial vector and current values. The bracelet requires an orientation change of over **60 degrees**.

## Communication & SOS Reporting (SIM800L GSM & GPS LC76G)

Upon a verified fall, the system fires an asynchronous task that delivers a pre-formatted URL and analytics (vitals + location) via the hardware SIM800L module (using a MicroSIM on 2G GPRS).
- **Location**: `$GNGGA` / `$GNRMC` format from LC76G with a Google Maps string template.
- **GSM Logic**: The chip operates via an AT command-base protocol. It is modified to be powered on via GPIO pulsing instead of manual button presses.
- **Network Stability**: A 1000µF electrolytic and 100nF ceramic capacitor are soldered directly to the VCC/GND pins of the SIM800L to absorb 2A current spikes and prevent `+CREG: 1,3` Registration Denied errors.
- **SMS Encoding**: Pure GSM Text-Mode (`AT+CMGF=1`) requiring `CTRL+Z (ASCII 26)` to confirm transmission.

## UI Management (LVGL) & Smart Power (AXP2101)

All calls to `ui_Label_setText()` must pass through `example_lvgl_lock()` Semaphore calls on `lvgl_mux` due to the framework's rigid nature.
The `AXP2101` PMIC manages charging and battery reporting. After 15s of inactivity, the MCU pauses rendering via `esp_lcd_panel_disp_on_off` (effectively turning off AMOLED pixels) and cuts the backlight signal for deep-sleep effects.

## Companion Mobile App (Flutter Companion)

A cross-platform app connects via BLE SPP to extend the bracelet's capabilities.
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Data Format**: `STATUS G:<g_force> P:<heartRate> S:<spo2> B:<battery> Lat:<lat> Lon:<lon>`
- **Features**: Live dashboard with color-coded states, 3-phase alarm mirroring, countdown cancellation, and automatic phone calls/SMS/SOS intents upon expiry.

## References

1. **ESP-IDF Programming Guide** - Official documentation for ESP32-S3 task management.
2. **FreeRTOS API Reference** - Documentation for Mutex/Semaphore usage.
3. **LVGL Documentation** - Porting and thread-safe interaction guide.
4. **QMI8658 Datasheet** - IMU hardware specifications.
5. **MAX30102 Datasheet** - PPG signal processing details.
6. **SIM800L AT Commands** - GSM modem control manual.
7. **Quectel LC76G Protocol** - NMEA sentence decoding guide.
8. **AXP2101 Datasheet** - Power management and sleep modes.
