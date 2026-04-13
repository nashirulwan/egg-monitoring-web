# 🥚 Egg Monitoring ESP32 Firmware

Firmware ESP32 untuk sistem monitoring kandang ayam & produksi telur.

## 📦 Komponen yang Dibutuhkan

| Komponen | Qty | Keterangan |
|---|---|---|
| **ESP32 DevKit V1** | 1 | Board utama (WiFi + Bluetooth) |
| **DHT11** | 1 | Sensor suhu & kelembapan |
| **IR Sensor Module** | 4 | Deteksi telur per sensor/ayam |
| **MQ Gas Sensor** | 1 | Deteksi gas/kotoran untuk trigger conveyor |
| **Relay Module 4-Channel** | 1 | Kontrol 2 kipas, lampu, motor DC conveyor |
| **Jumper Wires** | Secukupnya | Male-to-Male & Male-to-Female |
| **Breadboard / PCB** | 1 | Prototyping |
| **Power Supply 5V** | 1 | Untuk ESP32 + Relay |

## 🔌 Wiring Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        ESP32 DEVKIT                         │
│                                                             │
│  3V3 ────────┬── DHT11 VCC                                  │
│              ├── IR Sensor VCC                              │
│              └── Relay Module VCC                           │
│                                                             │
│  GND ────────┬── DHT11 GND                                  │
│              ├── IR Sensor GND                              │
│              └── Relay Module GND                           │
│                                                             │
│  GPIO 4  ────┤  DHT11 DATA (signal)                        │
│  GPIO 16 ────┤  Relay CH1 → KIPAS 1                        │
│  GPIO 17 ────┤  Relay CH2 → KIPAS 2                        │
│  GPIO 18 ────┤  IR Sensor 1 OUT → A001                     │
│  GPIO 19 ────┤  IR Sensor 2 OUT → A002                     │
│  GPIO 21 ────┤  IR Sensor 3 OUT → B001                     │
│  GPIO 22 ────┤  IR Sensor 4 OUT → B002                     │
│  GPIO 23 ────┤  Relay CH3 → LAMPU                          │
│  GPIO 27 ────┤  Relay CH4 → MOTOR DC CONVEYOR              │
│                                                             │
│  USB ────────┤  Power & Programming                        │
└─────────────────────────────────────────────────────────────┘
```

### Detail Koneksi

#### DHT11
| DHT11 Pin | ESP32 Pin |
|---|---|
| VCC (+) | 3V3 |
| DATA (OUT) | GPIO 4 |
| GND (-) | GND |

> **Tips:** Tambahkan resistor 10KΩ antara VCC dan DATA jika modul DHT11 belum punya pull-up resistor bawaan.

#### IR Sensor Module
| Sensor Telur | Sensor ID | ESP32 Pin |
|---|---|---|
| Sensor 1 | A001 | GPIO 18 |
| Sensor 2 | A002 | GPIO 19 |
| Sensor 3 | B001 | GPIO 21 |
| Sensor 4 | B002 | GPIO 22 |

> **Tips:** Atur potentiometer di modul IR untuk sensitivitas deteksi telur.

#### MQ Gas Sensor
| Gas Sensor Pin | ESP32 Pin |
|---|---|
| VCC | 3V3 |
| AO | GPIO 34 |
| GND | GND |

#### Relay Module (4-Channel)
| Relay Channel | ESP32 Pin | Kontrol |
|---|---|---|
| CH1 (IN1) | GPIO 16 | Kipas 1 |
| CH2 (IN2) | GPIO 17 | Kipas 2 |
| CH3 (IN3) | GPIO 23 | Lampu |
| CH4 (IN4) | GPIO 27 | Motor DC Conveyor |

| Relay Power | ESP32 Pin |
|---|---|
| VCC | 5V (atau 3V3 jika relay 3.3V compatible) |
| GND | GND |

> **⚠️ PERHATIAN:** Relay module aktif HIGH (HIGH = relay ON). Pastikan relay yang Anda pakai tipe active-HIGH. Jika active-LOW, logika di firmware perlu dibalik.

## 🛠️ Cara Install & Flash

### Opsi 1: PlatformIO (Recommended)

1. **Install VS Code** → https://code.visualstudio.com/
2. **Install Extension PlatformIO** → cari "PlatformIO IDE" di Extensions
3. **Buka folder project** → `egg_monitoring_firmware/`
4. **Edit konfigurasi WiFi** di `egg_monitoring_firmware.ino`:
   ```cpp
   const char* WIFI_SSID     = "NamaWiFiAnda";
   const char* WIFI_PASSWORD = "PasswordWiFiAnda";
   const char* SERVER_URL    = "https://egg.nashiru.me";
   const char* DEVICE_ID     = "esp32-01";
   ```
5. **Connect ESP32** ke komputer via USB
6. **Build & Upload:**
   - Klik ikon **✓** (Build) di status bar bawah
   - Klik ikon **→** (Upload) di status bar bawah
7. **Buka Serial Monitor:**
   - Klik ikon **🔌** (Serial Monitor)
   - Set baud rate ke `115200`

### Opsi 2: Arduino IDE

1. **Install Arduino IDE** → https://www.arduino.cc/en/software
2. **Install ESP32 Board Support:**
   - File → Preferences → Additional Board Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Board Manager → cari "ESP32" → Install
3. **Install Libraries** (Sketch → Include Library → Manage Libraries):
   - `ArduinoJson` by Benoit Blanchon (v7.x)
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
   - `NTPClient` by Fabrice Weinberg
4. **Pilih Board:** Tools → Board → ESP32 Arduino → "ESP32 Dev Module"
5. **Upload:** Sketch → Upload

## 📡 API Endpoint yang Digunakan

Firmware berkomunikasi dengan server di `https://egg.nashiru.me`:

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/iot/readings` | Kirim data suhu, kelembapan, dan gas |
| `POST` | `/api/iot/heartbeat` | Lapor device masih online |
| `POST` | `/api/iot/eggs` | Lapor telur terdeteksi per sensor ID |
| `POST` | `/api/iot/gas` | Lapor event gas jika dibutuhkan |

### Format Payload

**POST /api/iot/readings**
```json
{
  "deviceId": "esp32-01",
  "temperature": 37.5,
  "humidity": 55.2,
  "gasDetected": false,
  "gasValue": 240
}
```

**POST /api/iot/heartbeat**
```json
{
  "deviceId": "esp32-01",
  "rssi": -45,
  "freeHeap": 120000,
  "uptime": 3600
}
```

**POST /api/iot/eggs**
```json
{
  "deviceId": "esp32-01",
  "sensorId": "A001",
  "count": 1,
  "notes": "auto-detected"
}
```

**POST /api/iot/gas**
```json
{
  "deviceId": "esp32-01",
  "gasDetected": true,
  "analogValue": 720,
  "notes": "auto-detected"
}
```

### Logika Otomatis Relay

| Kondisi | Output |
|---|---|
| Suhu `> 28°C` | Kipas 1 dan Kipas 2 ON |
| Suhu `<= 28°C` | Kipas 1 dan Kipas 2 OFF |
| Suhu `< 28°C` | Lampu ON |
| Suhu `>= 28°C` | Lampu OFF |
| Gas `>= GAS_THRESHOLD` | Motor DC Conveyor ON |
| Gas `< GAS_THRESHOLD` | Motor DC Conveyor OFF |

## 🚀 Langkah Setup di Server

Sebelum flash firmware, pastikan device sudah terdaftar di database:

1. **Buka web UI** → `https://egg.nashiru.me`
2. **Buka halaman "Perangkat"**
3. **Tambah device baru** dengan ID yang sama dengan `DEVICE_ID` di firmware (default: `esp32-01`)
4. **Tambahkan aktuator** untuk device tersebut:
   - Type: `fan`, Name: `Kipas 1`
   - Type: `fan`, Name: `Kipas 2`
   - Type: `lamp`, Name: `Lampu`
   - Type: `conveyor`, Name: `Motor DC Conveyor`

> Atau jalankan SQL manual:
> ```sql
> INSERT INTO "Device" (id, name, type, "isActive") 
> VALUES ('esp32-01', 'ESP32 Kandang 1', 'ESP32', true);
> 
> INSERT INTO "Actuator" (id, "deviceId", name, type, pin, state) VALUES
>   (gen_random_uuid(), 'esp32-01', 'Kipas 1', 'fan', 16, false),
>   (gen_random_uuid(), 'esp32-01', 'Kipas 2', 'fan', 17, false),
>   (gen_random_uuid(), 'esp32-01', 'Lampu', 'lamp', 23, false),
>   (gen_random_uuid(), 'esp32-01', 'Motor DC Conveyor', 'conveyor', 27, false);
> ```

## 📊 Output Serial Monitor

Jika berhasil, serial monitor akan menampilkan:

```
========================================
  EGG MONITORING ESP32 — Starting...
========================================
Connecting to WiFi......
Connected! IP: 192.168.1.100
RSSI: -45
Setup complete. Starting main loop...
========================================
  Sensor → temp: 37.5°C, hum: 55.2%
  [/api/iot/readings] HTTP 200 → {"ok":true}
  Heartbeat → RSSI: -45, Heap: 120000, Uptime: 30s
  [/api/iot/heartbeat] HTTP 200 → {"ok":true,"timestamp":"2025-..."}
  Auto -> Fan1:ON Fan2:ON Lamp:OFF Conveyor:OFF
```

## 🔧 Troubleshooting

| Masalah | Solusi |
|---|---|
| WiFi tidak connect | Cek SSID & password, pastikan WiFi 2.4GHz (ESP32 tidak support 5GHz) |
| HTTP 404 dari server | Cek `SERVER_URL` dan pastikan device sudah terdaftar di DB |
| DHT11 baca NaN | Cek wiring, pastikan pin DATA di GPIO 4, tambah pull-up resistor 10K |
| Relay tidak nyala | Cek power relay (butuh 5V), cek pin signal di GPIO yang benar |
| IR sensor tidak trigger | Atur potentiometer sensitivitas di modul IR |
| Boot loop | Pastikan power supply cukup (min 500mA untuk ESP32 + relay) |

## 📝 License

MIT
