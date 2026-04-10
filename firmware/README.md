# 🥚 Egg Monitoring ESP32 Firmware

Firmware ESP32 untuk sistem monitoring kandang ayam & produksi telur.

## 📦 Komponen yang Dibutuhkan

| Komponen | Qty | Keterangan |
|---|---|---|
| **ESP32 DevKit V1** | 1 | Board utama (WiFi + Bluetooth) |
| **DHT11** | 1 | Sensor suhu & kelembapan |
| **IR Sensor Module** | 1 | Deteksi telur (infrared obstacle) |
| **Relay Module 3-Channel** | 1 | Kontrol kipas, lampu, buzzer |
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
│  GPIO 5  ────┤  IR Sensor OUT (signal)                     │
│  GPIO 16 ────┤  Relay CH1 → KIPAS (Fan)                    │
│  GPIO 17 ────┤  Relay CH2 → LAMPU (Lamp)                   │
│  GPIO 18 ────┤  Relay CH3 → BUZZER                         │
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
| IR Sensor Pin | ESP32 Pin |
|---|---|
| VCC | 3V3 |
| OUT (Digital) | GPIO 5 |
| GND | GND |

> **Tips:** Atur potentiometer di modul IR untuk sensitivitas deteksi telur.

#### Relay Module (3-Channel)
| Relay Channel | ESP32 Pin | Kontrol |
|---|---|---|
| CH1 (IN1) | GPIO 16 | Kipas (Fan) |
| CH2 (IN2) | GPIO 17 | Lampu (Lamp) |
| CH3 (IN3) | GPIO 18 | Buzzer |

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
| `POST` | `/api/iot/readings` | Kirim data suhu & kelembapan |
| `POST` | `/api/iot/heartbeat` | Lapor device masih online |
| `POST` | `/api/iot/eggs` | Lapor telur terdeteksi |
| `GET`  | `/api/actuators` | Ambil status relay terbaru |

### Format Payload

**POST /api/iot/readings**
```json
{
  "deviceId": "esp32-01",
  "temperature": 37.5,
  "humidity": 55.2
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
  "count": 1,
  "notes": "auto-detected"
}
```

**GET /api/actuators** → Response:
```json
{
  "actuators": [
    { "id": "xxx", "type": "fan", "state": true },
    { "id": "yyy", "type": "lamp", "state": false },
    { "id": "zzz", "type": "buzzer", "state": false }
  ]
}
```

## 🚀 Langkah Setup di Server

Sebelum flash firmware, pastikan device sudah terdaftar di database:

1. **Buka web UI** → `https://egg.nashiru.me`
2. **Buka halaman "Perangkat"**
3. **Tambah device baru** dengan ID yang sama dengan `DEVICE_ID` di firmware (default: `esp32-01`)
4. **Tambahkan 3 aktuator** untuk device tersebut:
   - Type: `fan`, Name: `Kipas`
   - Type: `lamp`, Name: `Lampu`
   - Type: `buzzer`, Name: `Buzzer`

> Atau jalankan SQL manual:
> ```sql
> INSERT INTO "Device" (id, name, type, "isActive") 
> VALUES ('esp32-01', 'ESP32 Kandang 1', 'ESP32', true);
> 
> INSERT INTO "Actuator" (id, "deviceId", name, type, pin, state) VALUES
>   (gen_random_uuid(), 'esp32-01', 'Kipas', 'fan', 16, false),
>   (gen_random_uuid(), 'esp32-01', 'Lampu', 'lamp', 17, false),
>   (gen_random_uuid(), 'esp32-01', 'Buzzer', 'buzzer', 18, false);
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
  Fan → OFF
  Lamp → OFF
  Buzzer → OFF
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
