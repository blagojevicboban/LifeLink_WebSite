# LifeLink - User Manual (Usage Instructions)

Welcome to the user guide for your **LifeLink** smart health-safety bracelet, built on the powerful ESP32-S3 platform! This smart bracelet features a round glass AMOLED touch screen and is primarily designed as your guardian for health and safety.

Why does LifeLink protect you? Through its powerful built-in sensors, it constantly "listens" to your heart, blood flow, and every change in speed as you move towards the floor — preventing false arm jerks, it guarantees that it really calls for help when you fall and get injured.

---

## Basic Navigation

Your screen works on a **Swipe** basis:

1.  **Main Home Screen (Time and Parameters Display)**
    When you unlock and touch the device, you arrive here. This screen is your home and control panel:
    -   Your data (HR / SpO2 in percentage), Heart Rate, and Oxygen, are all in front of your eyes.
    -   Above the text are very small icons that can change color (Red, Orange, and Green). These are statuses: `GPS` connection (whether LifeLink "knows" your location), `GSM` antenna status (whether it catches a signal), and similar.

2.  **"Debug / Fall Simulation" Screen (Swipe Left)**
    -   Swipe from the left edge of the bracelet towards the center with your finger.
    -   Here is the "Debug" station icon and a huge button for activating "Simulate FALL". Although the system is excellent at ignoring your ordinary movements, for people in the workplace, it is ideal to press the button before experimenting or climbing just to activate the alert process just in case.

3.  **Emergency Contact Input Screen (Swipe below or next to the Main one)**
    -   As you continue through the bracelet menus, you will come across an enlarged keyboard that makes it easier for even patients to type numerical contacts.
    -   Simply enter the number where the emergency messages and mapped GPS (Google Maps) link to you should arrive and press (Save). The number is stored deep in the bracelet and is safe from deletion unless you overwrite it, and will remain tied even when the battery runs out.

---

## Viewing the Emergency Screen (SOS)

When the device (or simulated you) triggers a fall — an ominous **Red "DID YOU FALL?" screen** occurs.

On this window, the bracelet counts down 15 seconds to disaster — a call to action! Why 15 seconds? If you didn't fall but dropped the bracelet, you can calmly swipe your finger across the red screen once and it will immediately stop the countdown, dampen the drama, and the bracelet returns to the safe Main Home screen to continue measuring without fear! Otherwise, "CALLING FOR HELP!!!" messages will be fired automatically to the preconfigured numbers on the SIM network.

---

## Mobile Application and Cloud Dashboard

Your bracelet is no longer alone! Now you can use additional tools for even greater security:

### 1. LifeLink Companion App
Install the application on your Android phone to:
- **See live data**: Pulse, SpO2, and G-force are transmitted to the phone screen in real time.
- **Set up the bracelet**: Easily enter phone numbers and change settings via Bluetooth.
- **Find the watch**: If you misplace it, the app can show you the last known GPS location.

### 2. LifeLink Cloud Dashboard (Web page)
Your loved ones (family members or doctors) can monitor your state from any computer or phone via the internet at `lifelink.tsp.edu.rs/dashboard/`:
- **Dual Y-Axis Charts**: Each chart tracks two parameters simultaneously for easier comparison:
    - **Top Chart**: Tracks **Pulse** (red line, left y-axis) and **SpO2** (blue line, right y-axis).
    - **Bottom Chart**: Tracks **G-Force** (cyan line, left y-axis) and **Battery** (green line, right y-axis).
- **Time Ranges**: Use the buttons above the charts to select the view for the last **1h, Today, 7 days, or 30 days**.
- **Fall Notifications**: Even if they are not with you, they will receive an audible and text notification on their device as soon as the watch detects a fall.
- **Interactive Map**: Precise display of your location at any moment (blue marker is the watch, green marker is the phone).

Enjoy knowing that technology is not just watching you, but actively guarding you and connecting you with your loved ones.
