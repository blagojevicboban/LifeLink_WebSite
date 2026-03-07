# LifeLink Algorithms Documentation

This document describes the signal processing algorithms used in the LifeLink project for Vital Signs monitoring and Fall Detection.

## 1. Heart Rate & SpO2 (FFT-Based)

We use the **Fast Fourier Transform (FFT)** to analyze the Photoplethysmogram (PPG) signal from the MAX30102 sensor. This method is more robust against motion artifacts compared to simple peak detection w. time-domain analysis.

### Implementation Details:
- **Library**: `espressif/esp-dsp` (Hardware accelerated on ESP32-S3).
- **Sampling Rate**: 100 Hz.
- **Buffer Size**: 512 samples (~5.12 seconds of data).
- **Window**: Sliding window with 50-sample overlap updates (~0.5s refresh).

### Steps:
1.  **DC Removal**: Subtract the mean value of the signal (0Hz component).
2.  **Windowing**: Apply a **Hann Window** to reduce spectral leakage.
3.  **FFT**: Compute the complex FFT using `dsps_fft2r_fc32`.
4.  **Power Spectrum**: Calculate magnitudes for both Red and IR channels.
5.  **Peak Detection**: Find the dominant frequency bin in the 0.5Hz - 4.0Hz range (30 - 240 BPM).
6.  **SpO2 Calculation**:
    - **AC and DC Component Extraction**:
        - **DC Component**: Represents constant light absorption by tissues/bones (magnitude at 0Hz).
        - **AC Component**: Represents pulsating absorption by arterial blood (magnitude at the detected heart rate frequency).
    - **Normalization**: Dividing AC by DC for each channel eliminates variables like skin tone or sensor pressure.
    - **Ratio of Ratios Calculation**:
    $$R = \frac{AC_{red}/DC_{red}}{AC_{ir}/DC_{ir}}$$
    - **Empirical Formula**: Final saturation is derived using a linear approximation:
    $$SpO_2 = 110 - 25 \times R$$
    *(Note: Linear fit provides +/- 2% accuracy within the 70-100% range while being computationally efficient for MCU execution.)*

---

## 2. Advanced Fall Detection (3-Phase Model)

The fall detection uses data from the QMI8658 IMU (Accelerometer + Gyroscope) and implements a state machine to distinguish real falls from daily activities.

### Core Concept: SVM (Signal Vector Magnitude)
The total G-force is calculated as:
$$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
In rest, $SVM \approx 1.0g$.

### The 3-Phase Logic:

#### Phase 1: Free Fall
- **Physics**: The moment of weightlessness as the body starts to drop.
- **Trigger**: SVM drops below `0.6g`.
- **Key Action**: The system records the **reference orientation** ($\vec{v}_{ref}$) — the position of the arm just before the incident.

#### Phase 2: Impact
- **Physics**: Collision with the ground creating high G-force acceleration.
- **Time Window**: Impact must occur within 500ms of Phase 1.
- **Trigger**: SVM spikes above `3.5g`. If no free fall preceded the spike, it is ignored (e.g., hitting a table).

#### Phase 3: Stillness & Orientation Check
- **Stillness**: System waits for 5 seconds of stability. Any significant movement cancels the alarm.
- **Orientation Shift**: If still, the current gravity vector is compared to the reference from Phase 1.
- **Formula**: $\theta = \arccos(\frac{v_{ref} \cdot v_{curr}}{|v_{ref}| \cdot |v_{curr}|})$
- **Confirmation**: If orientation shift $\theta > 60^\circ$ AND user is still $\rightarrow$ **CONFIRMED FALL**.

## 3. Sensor Fusion & Rate Limiting

- **GPS (LC76G)**: Polled every 100ms, retry logic for robust I2C reading.
- **Rate Limiting**:
    - Sensor Polling: 100Hz (Real-time).
    - UI/Log Reporting: 10Hz (Every 0.1s) to save CPU cycles for DSP.
