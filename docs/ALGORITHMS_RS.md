# Dokumentacija LifeLink Algoritama

Ovaj dokument opisuje algoritme za obradu signala koji se koriste u LifeLink projektu za praćenje vitalnih funkcija i detekciju pada.

## 1. Puls i SpO2 (Bazirano na FFT-u)

Koristimo **Brzu Furijeovu Transformaciju (FFT)** za analizu fotopletizmogramskog (PPG) signala sa MAX30102 senzora. Ova metoda je robusnija protiv artefakata pokreta u poređenju sa jednostavnom detekcijom vrhova u vremenskom domenu.

### Detalji Implementacije:
- **Biblioteka**: `espressif/esp-dsp` (Hardverski ubrzano na ESP32-S3).
- **Brzina uzorkovanja**: 100 Hz.
- **Veličina bafera**: 512 uzoraka (~5.12 sekundi podataka).
- **Prozor**: Klizni prozor sa preklapanjem od 50 uzoraka (~0.5s osvežavanje).

### Koraci:
1.  **Uklanjanje DC komponente**: Oduzimanje srednje vrednosti signala (0Hz komponenta).
2.  **Prozorska funkcija**: Primena **Hann prozora** za smanjenje spektralnog curenja.
3.  **FFT**: Izračunavanje kompleksnog FFT-a koristeći `dsps_fft2r_fc32`.
4.  **Spektar snage**: Izračunavanje magnituda za crveni (Red) i infracrveni (IR) kanal.
5.  **Detekcija vrha**: Pronalaženje dominantne frekvencije u opsegu 0.5Hz - 4.0Hz (30 - 240 BPM).
6.  **Izračunavanje SpO2**:
    - Ekstrakcija AC komponenti (magnituda vrha) i DC komponenti (srednja vrednost) za Red i IR.
    - Izračunavanje odnosa $R = \frac{AC_{red}/DC_{red}}{AC_{ir}/DC_{ir}}$.
    - Primena formule: $SpO_2 = 110 - 25 \times R$.

---

## 2. Napredna Detekcija Pada (3-Fazni Model)

Detekcija pada koristi podatke sa QMI8658 IMU senzora (akcelerometar + žiroskop) i implementira mašinu stanja kako bi razlikovala stvarne padove od svakodnevnih aktivnosti.

### Osnovni koncept: SVM (Signal Vector Magnitude)
Totalna G-sila se izračunava kao:
$$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
U stanju mirovanja, $SVM \approx 1.0g$.

### 3-Fazna Logika:

#### Faza 1: Slobodan Pad
- **Okidač**: SVM pada ispod `0.6g` (`FALL_THRESHOLD_LOW`).
- **Akcija**:
    - Sistem ulazi u `FREE_FALL` stanje.
    - Snima **referentnu orijentaciju** (vektor gravitacije $\vec{v}_{ref}$) za kasniju poređenje.

#### Faza 2: Udarac
- **Vremenski prozor**: Mora se desiti u roku od 500ms nakon slobodnog pada.
- **Okidač**: SVM skače iznad `3.5g` (`FALL_THRESHOLD_HIGH`).
- **Akcija**: Sistem ulazi u stanje `WAITING_FOR_STILLNESS`.

#### Faza 3: Mirovanje i Provera Orijentacije
- **Trajanje**: Sistem prati stabilnost tokom **5 sekundi** (`STILLNESS_DURATION_MS`).
- **Akcija**:
    - Ako se korisnik značajno pomeri (SVM odstupa > 0.2g od 1g), pad se odbacuje.
    - Nakon 5 sekundi, ako je korisnik miran, proveravamo **promenu orijentacije**.

### Verifikacija Orijentacije
Da bismo sprečili lažno pozitivne rezultate (npr. tapšanje, udarac o sto), poredimo orijentaciju uređaja pre i posle "pada".

- **Formula**:
$\theta = \arccos(\frac{v_{ref} \cdot v_{curr}}{|v_{ref}| \cdot |v_{curr}|})$
- **Uslov**: Ako je $\theta > 60^\circ$ I korisnik miruje $\rightarrow$ **POTVRĐEN PAD**.

---

## 3. Fuzija Senzora i Ograničenje Brzine

- **GPS (LC76G)**: Očitava se svakih 100ms, uz logiku ponovnog pokušaja za robusno I2C čitanje.
- **Ograničenje brzine**:
    - Uzorkovanje senzora: 100Hz (Realno vreme).
    - Izveštavanje u UI/Log: 10Hz (Svakih 0.1s) radi uštede CPU ciklusa za DSP obradu.
