# LIFELINK
**- Smart health-safety bracelet for health monitoring, fall detection, and automatic emergency calls -**

**Team Name:** LIFE LINK - BRACELET FOR HELPING THE MOST VULNERABLE PATIENTS 
**Authors:** Kristina Gocev, Teodora Pejčić, Luka Vučić, Mihailo Pešić, Sava Petrović  
Students of class IV-1, 2025/2026 
Technical School Pirot  

**Mentor:** BOBAN BLAGOJEVIĆ, B.Sc. Electrical Engineering, teacher of electrical engineering subjects at Technical School Pirot

---

## SUMMARY

The LifeLink project represents an advanced smart health-safety bracelet based on the ESP32-S3 platform, designed primarily as a safety assistant for the most vulnerable patients and elderly individuals. LifeLink combines the processing power of the ESP-IDF framework with the LVGL graphics library, providing a visually appealing user interface on a circular AMOLED display with a resolution of 466x466 pixels. The bracelet's hardware and software work together to monitor health parameters and alert caregivers in emergency situations.

The device continuously measures vital parameters such as heart rate (BPM) and blood oxygen level (SpO2) using the MAX30102 medical sensor. Its most critical function is advanced fall detection – the device integrates the QMI8658 inertial sensor (accelerometer and gyroscope) with a specialized software algorithm that recognizes a free fall followed by a hard impact and subsequent immobility, effectively filtering out false alarms (e.g., from sudden hand movements). Upon detecting a real fall, the device displays a red notification and begins a 5-second countdown. If the user is not actually injured and does not need help, the countdown can be canceled with a touch. Otherwise, the SIM800L GSM network module autonomously (without requiring a smartphone) sends an SMS to a programmed emergency number. The message contains the status of health vitals at the moment of the fall, a warning, and a direct link to the GPS location on Google Maps.

The entire interaction menu is designed for simplicity, supporting phone number input directly via an enlarged on-screen keyboard. The autonomy of this network module and its independent operation in an integrated graphical environment make LifeLink a reliable, innovative, and useful solution for enhancing health security.

---

## WORKING PRINCIPLE AND PRACTICAL REALIZATION

### a.) Brief Description
LifeLink synchronizes a powerful ESP32-S3 microcontroller with peripheral hardware using an advanced ESP-IDF task structure (FreeRTOS Tasks), managing parallel processes across multiple cores. On top of the operating system, LVGL renders touch-sensitive menus that users navigate via swipe gestures. The program sends real-time commands via I2C interface to read the IMU gyroscope and the optical oximeter on the back of the device.

For efficient and seamless communication with the outside world, the bracelet features an independent SIM800L GSM module. This compact module (only 2.5×2.3 cm) is powered directly from a Li-Ion battery (3.7–4.2V) without the need for an external boost converter, significantly improving power stability. During registration on the 2G GSM network, the module can pull sudden current spikes of up to 2 Amperes. To absorb these spikes, 1000µf electrolytic and 100nf ceramic capacitors are soldered directly to the VCC and GND pins of the module. The module communicates with the device via serial UART protocol using standard AT commands. The software also includes an automatic recovery mechanism that restarts the module after 3 consecutive communication failures.

### b.) Components

| Component Name | Purpose |
| --- | --- |
| **ESP32-S3** | Microcontroller that runs the OS, communicates with sensors, and handles graphics processing. |
| **Round AMOLED Display (466x466)** | High-quality touchscreen display for the bracelet's user interface. |
| **QMI8658 IMU Sensor** | Detects inertial G-forces from impacts, rotational tilt, and user immobility. |
| **SIM800L GSM Module** | Compact Quad-band 2G module for automatic emergency SMS dispatch without a phone. Powered directly from 3.7V Li-Ion battery. |
| **MAX30102 Sensor** | Optical reading of heart rate and oxygen saturation for monitoring biological functions. |
| **AXP2101 PMIC** | Power consumption regulation and safe management of Li-Ion battery charging. |
| **Li-Ion Battery (3.7V)** | Portable power source with capacity to ensure stable independent operation for hours. |

### c.) System Schema
![alt text](components/DOCs/LifeLink-sch.jpg)  
**Figure 4 – Practical realization of LifeLink sensors and device communication block diagram**

### d.) Program Code

**Figure 6 - Snippet of C code for formatting and sending SMS (FreeRTOS/UART):**
```c
// Automatic SMS dispatch during an accident - part of the gsm_a6.c module function (compatible with SIM800L)
void send_sos_sms(const char* phone_no, int hr, float latitude, float longitude) {
    char sms_payload[256];
    // Formatting SOS text message with vital parameters and location
    snprintf(sms_payload, sizeof(sms_payload), 
        "Emergency! FALL detected!\n"
        "Pulse: %d BPM\n"
        "Location: https://maps.google.com/?q=%.6f,%.6f", 
        hr, latitude, longitude);
        
    // Execute AT commands via hardware UART port communication
    uart_write_bytes(UART_NUM_1, "AT+CMGF=1\r", 10);
    vTaskDelay(pdMS_TO_TICKS(500));
    
    char at_cmd[64];
    snprintf(at_cmd, sizeof(at_cmd), "AT+CMGS=\"%s\"\r", phone_no);
    uart_write_bytes(UART_NUM_1, at_cmd, strlen(at_cmd));
    vTaskDelay(pdMS_TO_TICKS(500));
    
    // Start writing to the serial port
    uart_write_bytes(UART_NUM_1, sms_payload, strlen(sms_payload));
    
    // Confirm and send the SMS command with terminal character 26 (CTRL+Z)
    char ctrl_z = 26;
    uart_write_bytes(UART_NUM_1, &ctrl_z, 1);
}
```

---

## RESULT
After soldering the physical circuits, developing the C code following the recommended ESP-IDF architecture on two processing cores, and rendering the LVGL menus, we conducted a series of stress tests. The focus of testing was calibrating the fall detection sensitivity of the QMI8658 module. The algorithm was filtered to prevent false alarms by ensuring that sudden acceleration changes (free fall to the ground) are now necessarily followed by a stationary period and an inverted orientation vector, successfully avoiding errors during hand waving or simple pushing.

Another success point lies in the transition to the SIM800L GSM module powered directly from the Li-Ion battery (3.7–4.2V), eliminating the need for an external boost converter and incorporating filter capacitors (1000µf electrolytic + 100nf ceramic) in parallel with the VCC/GND pins. This contributed to full network coverage and signal stability, eliminating the 5V power loss issues previously caused by the boost converter. The software's automatic recovery mechanism further ensures system reliability by restarting the module after consecutive failures. The final result is a fully functional smart bracelet with an impressive interface that, unlike modern smartwatches, is not solely tied to a mobile phone via Bluetooth but possesses integrated biological monitoring and reports incidents via its own independent GSM SMS solution, thus providing a high degree of portable safety for the most vulnerable patients and elderly individuals.

---

## MOBILE APPLICATION (LifeLink Companion App)

In addition to the bracelet's autonomous operation, a companion mobile application was developed using the **Flutter** framework, extending LifeLink's capabilities via a Bluetooth Low Energy (BLE) connection.

### a.) Application Functionalities

| Functionality | Description |
| --- | --- |
| **Live Dashboard** | Displays vital parameters in real-time: heart rate (BPM), blood oxygenation (SpO2), impact force (G-Force), and GPS location. |
| **BLE Connection** | Automatic or manual pairing with the LifeLink bracelet via BLE SPP protocol. Displays connection status and battery level. |
| **Fall Detection (Mirror)** | The app receives data from the bracelet and implements its own 3-phase system: **Safe** (green) → **Warning** (orange) → **Alarm** (red). |
| **Countdown & Cancellation** | 5-second countdown before activating emergency actions, with the ability to cancel false alarms. |
| **Automatic SOS Response** | Upon countdown expiry, executes the configured fall response: call, SMS with GPS location, or system SOS. |
| **Settings** | Configuration of emergency contact (name and number), fall action choice (call/SMS/SOS), countdown duration, and device MAC address. |
| **Location Map** | Displays user location on an interactive map using the phone's GPS to assist rescuers. |
| **Haptics & Sound Alarm** | Vibration and audio alarm on the phone during fall detection for extra warning. |

### b.) Mobile Application Technologies

| Technology | Purpose |
| --- | --- |
| **Flutter (Dart)** | Cross-platform development for Android, iOS, and Windows from a single codebase. |
| **flutter_blue_plus** | BLE communication with the ESP32-S3 bracelet (service UUID: `4fafc201-...`). |
| **Provider** | State management for reactive user interface updates. |
| **Geolocator** | Reading the phone's GPS location for SOS messages. |
| **flutter_map + latlong2** | Location display on OpenStreetMap. |
| **shared_preferences** | Local storage of user settings (contact, action, MAC address). |
| **url_launcher / flutter_phone_direct_caller** | Launching calls or SMS from the phone. |
| **vibration / audioplayers** | Tactile and audio alarms during fall detection. |

### c.) Application Architecture

The application uses the **MVVM** (Model-View-ViewModel) pattern:
- **`BleService`** – Singleton service for BLE scanning, connection, and characteristic subscription.
- **`SensorProvider`** – Central ChangeNotifier that parses data from the bracelet (`STATUS G:X.XX P:XX S:XX B:XX Lat:XX Lon:XX`), manages alarm states, and triggers emergency actions.
- **`DashboardScreen`** – Main screen displaying metrics, connection status, and map.
- **`SettingsScreen`** – Configuration screen for emergency contact, actions, and BLE device.


## CONCLUSION
The presented prototype of the LifeLink platform offers exceptional potential. Its greatest advantage is the modular, multi-functional approach in a small form factor. Further work on the project will certainly include deeper battery optimization – by creating a "Deep Sleep" logic step and display power management – as well as the manufacturing of a dedicated custom 3D enclosure to protect the assembly from moisture or impacts, and integration of artificial intelligence (Edge Impulse/TinyML). The ability to "train" small classification neural networks directly on the ESP32 hardware would drastically increase the power of accident recognition and fall type prediction based on richer datasets. Despite the current device's prototypical nature, the efficiency and independence of the tested modules prove its high and life-saving wearable applicability in real-world scenarios.

## ACKNOWLEDGEMENTS
We would like to thank our mentor Boban Blagojević, professor Bojan Ćirić, and professor Sanja Rančić for their great support, professional assistance, and useful advice during the project realization. Special thanks go to mentor Milica Petković from BOSCH for her selfless help and professional contribution, as well as to Zoran Dimitrov for his help in creating the adjustable strap. We also thank Startup Center Pirot and the collective of Technical School Pirot for their support and cooperation.

## LITERATURE AND REFERENCES
[1] ESP-IDF Framework platform and FreeRTOS repositories – Espressif – https://docs.espressif.com  
[2] LVGL Graphic Library – Visualization, design, and management branch – https://lvgl.io  
[3] SIM800L GSM Module Datasheet / AT Commands – SIMCom documentation  
[4] QMI8658C Attitude & Motion Detection IMU Datasheet and Data table for C integration  
[5] MAX30102 High-Sensitivity Pulse Oximeter and Heart-Rate Sensor for Wearable Health devices  
[6] Google Maps URL Schema – Standards for linking API location search frames – https://developers.google.com/maps/documentation/urls/get-started
