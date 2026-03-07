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
    - **Ekstrakcija AC i DC komponenti**: 
        - **DC komponenta**: Predstavlja konstantnu apsorpciju svetlosti od strane tkiva i kostiju (dobija se iz magnitude na 0Hz frekvenciji FFT-a).
        - **AC komponenta**: Predstavlja pulsirajuću apsorpciju arterijske krvi (magnituda na frekvenciji pulsa).
    - **Normalizacija**: AC vrednost se deli sa DC vrednošću za svaki kanal kako bi se eliminisali faktori poput boje kože ili pritiska na senzor.
    - **Izračunavanje odnosa (Ratio of Ratios)**: 
    $$R = \frac{AC_{red}/DC_{red}}{AC_{ir}/DC_{ir}}$$
    - **Linearna (Empirijska) aproksimacija**: Finalni procenat se dobija formulom: 
    $$SpO_2 = 110 - 25 \times R$$
    *(Napomena: Iako je stvarna kriva blago nelinearna, u opsegu od 70-100% linearna aproksimacija nudi preciznost od +/- 2% uz minimalno procesorsko opterećenje.)*

---

## 2. Napredna Detekcija Pada (3-Fazni Model)

Detekcija pada koristi podatke sa QMI8658 IMU senzora (akcelerometar + žiroskop) i implementira mašinu stanja kako bi razlikovala stvarne padove od svakodnevnih aktivnosti.

### Osnovni koncept: SVM (Signal Vector Magnitude)
Totalna G-sila se izračunava kao:
$$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
U stanju mirovanja, $SVM \approx 1.0g$.

### 3-Fazna Logika:

#### Faza 1: Slobodan Pad
- **Fizika**: Trenutak gubitka težine dok telo počinje da pada.
- **Okidač**: SVM pada ispod `0.6g`.
- **Ključna akcija**: Sistem snima **referentnu orijentaciju** ($\vec{v}_{ref}$) — položaj ruke neposredno pre incidenta.

#### Faza 2: Udarac (Impact)
- **Fizika**: Sudar tela sa podlogom koji stvara naglo ubrzanje.
- **Vremenski prozor**: Šiljak se mora desiti unutar 500ms od Faze 1.
- **Okidač**: SVM skače iznad `3.5g`. Ako nema prethodnog slobodnog pada, udarac se ignoriše (npr. udarac rukom o sto).

#### Faza 3: Mirovanje i Provera Orijentacije
- **Mirovanje**: Sistem čeka 5 sekundi. Ako se detektuje pokret, alarm se poništava (korisnik je dobro).
- **Provera ugla**: Ako je korisnik miran, poredi se trenutni vektor gravitacije sa referentnim iz Faze 1.
- **Formula**: $\theta = \arccos(\frac{v_{ref} \cdot v_{curr}}{|v_{ref}| \cdot |v_{curr}|})$
- **Potvrda**: Ako je promena ugla $\theta > 60^\circ$, sistem potvrđuje da korisnik leži i aktivira SOS.

---

## 3. Fuzija Senzora i Ograničenje Brzine

- **GPS (LC76G)**: Očitava se svakih 100ms, uz logiku ponovnog pokušaja za robusno I2C čitanje.
- **Ograničenje brzine**:
    - Uzorkovanje senzora: 100Hz (Realno vreme).
    - Izveštavanje u UI/Log: 10Hz (Svakih 0.1s) radi uštede CPU ciklusa za DSP obradu.
