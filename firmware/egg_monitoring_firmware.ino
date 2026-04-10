/*
 * ============================================================
 *  EGG MONITORING & CONTROL — ESP32 FIRMWARE
 * ============================================================
 *
 *  Sensor:
 *    - DHT11  → Suhu & Kelembapan
 *    - IR Sensor → Hitung Telur (pulse detection)
 *
 *  Aktuator (via Relay Module):
 *    - Relay 1 → Kipas (Fan)
 *    - Relay 2 → Lampu (Lamp)
 *    - Relay 3 → Buzzer
 *
 *  Server API:
 *    POST /api/iot/readings    → kirim data sensor
 *    POST /api/iot/heartbeat   → lapor status device
 *    POST /api/iot/eggs        → lapor telur terdeteksi
 *    GET  /api/actuators       → ambil status relay terbaru
 *
 *  Wiring:
 *    DHT11 Data     → GPIO 4
 *    IR Sensor Out  → GPIO 5
 *    Relay Fan      → GPIO 16
 *    Relay Lamp     → GPIO 17
 *    Relay Buzzer   → GPIO 18
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// ============================================================
//  KONFIGURASI — UBAH SESUAI KEBUTUTUHAN
// ============================================================

// WiFi
const char* WIFI_SSID     = "NamaWiFi";
const char* WIFI_PASSWORD = "PasswordWiFi";

// Server
const char* SERVER_URL    = "https://egg.nashiru.me";

// Device ID — harus sama dengan yang ada di database server
// Daftar dulu via web UI di halaman "Perangkat"
const char* DEVICE_ID     = "esp32-01";

// Interval (milidetik)
const unsigned long SENSOR_INTERVAL   = 10000;   // 10 detik
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 detik
const unsigned long ACTUATOR_POLL_INTERVAL = 5000; // 5 detik

// Pin
#define DHT_PIN        4
#define IR_SENSOR_PIN  5
#define RELAY_FAN_PIN  16
#define RELAY_LAMP_PIN 17
#define RELAY_BUZZER_PIN 18

// DHT Type
#define DHT_TYPE DHT11

// ============================================================
//  GLOBAL VARIABLES
// ============================================================

DHT dht(DHT_PIN, DHT_TYPE);

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); // WIB UTC+7

unsigned long lastSensorTime    = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastActuatorTime  = 0;

// IR Egg Counter
volatile int eggCount = 0;
unsigned long lastIrTrigger = 0;
const unsigned long IR_DEBOUNCE_MS = 1000;  // debounce 1 detik

// Actuator state (dari server)
bool serverFanState   = false;
bool serverLampState  = false;
bool serverBuzzerState = false;

// ============================================================
//  IR INTERRUPT — hitung telur
// ============================================================

void IRAM_ATTR irInterrupt() {
  unsigned long now = millis();
  if (now - lastIrTrigger > IR_DEBOUNCE_MS) {
    lastIrTrigger = now;
    eggCount++;
  }
}

// ============================================================
//  WIFI
// ============================================================

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\nWiFi connection FAILED, restarting...");
    ESP.restart();
  }
}

// ============================================================
//  HTTP HELPERS
// ============================================================

int sendPost(const char* endpoint, const char* jsonBody) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return -1;
  }

  HTTPClient http;
  http.begin(String(SERVER_URL) + String(endpoint));
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.printf("  [%s] HTTP %d → %s\n", endpoint, httpCode, payload.c_str());
  } else {
    Serial.printf("  [%s] HTTP Error: %s\n", endpoint, http.errorToString(httpCode).c_str());
  }

  http.end();
  return httpCode;
}

int sendGet(const char* endpoint, String& response) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return -1;
  }

  HTTPClient http;
  http.begin(String(SERVER_URL) + String(endpoint));

  int httpCode = http.GET();

  if (httpCode > 0) {
    response = http.getString();
  } else {
    Serial.printf("  [GET %s] HTTP Error: %s\n", endpoint, http.errorToString(httpCode).c_str());
  }

  http.end();
  return httpCode;
}

// ============================================================
//  KIRIM DATA SENSOR
// ============================================================

void sendSensorData() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("  DHT11 read FAILED, skipping sensor report");
    return;
  }

  StaticJsonDocument<128> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["temperature"] = temp;
  doc["humidity"]    = hum;

  char jsonBuf[128];
  serializeJson(doc, jsonBuf);

  Serial.printf("  Sensor → temp: %.1f°C, hum: %.1f%%\n", temp, hum);
  sendPost("/api/iot/readings", jsonBuf);
}

// ============================================================
//  KIRIM HEARTBEAT
// ============================================================

void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["rssi"]     = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"]   = (unsigned long)(millis() / 1000);

  char jsonBuf[128];
  serializeJson(doc, jsonBuf);

  Serial.printf("  Heartbeat → RSSI: %d, Heap: %lu, Uptime: %lus\n",
                WiFi.RSSI(), ESP.getFreeHeap(), (unsigned long)(millis() / 1000));
  sendPost("/api/iot/heartbeat", jsonBuf);
}

// ============================================================
//  KIRIM DATA TELUR
// ============================================================

void sendEggData() {
  if (eggCount == 0) return;

  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["count"]    = eggCount;
  doc["notes"]    = "auto-detected";

  char jsonBuf[128];
  serializeJson(doc, jsonBuf);

  Serial.printf("  Eggs → count: %d\n", eggCount);
  sendPost("/api/iot/eggs", jsonBuf);

  eggCount = 0;
}

// ============================================================
//  POLLING STATUS AKTUATOR DARI SERVER
// ============================================================

void pollActuators() {
  String response;
  int httpCode = sendGet("/api/actuators", response);

  if (httpCode != 200 || response.length() == 0) {
    Serial.println("  Poll actuators FAILED");
    return;
  }

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, response);

  if (err) {
    Serial.printf("  JSON parse error: %s\n", err.c_str());
    return;
  }

  JsonArray actuators = doc["actuators"];

  for (JsonObject act : actuators) {
    const char* type  = act["type"];
    bool state        = act["state"];

    if (strcmp(type, "fan") == 0) {
      serverFanState = state;
      digitalWrite(RELAY_FAN_PIN, state ? HIGH : LOW);
      Serial.printf("  Fan → %s\n", state ? "ON" : "OFF");
    }
    else if (strcmp(type, "lamp") == 0) {
      serverLampState = state;
      digitalWrite(RELAY_LAMP_PIN, state ? HIGH : LOW);
      Serial.printf("  Lamp → %s\n", state ? "ON" : "OFF");
    }
    else if (strcmp(type, "buzzer") == 0) {
      serverBuzzerState = state;
      digitalWrite(RELAY_BUZZER_PIN, state ? HIGH : LOW);
      Serial.printf("  Buzzer → %s\n", state ? "ON" : "OFF");
    }
  }
}

// ============================================================
//  SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  EGG MONITORING ESP32 — Starting...");
  Serial.println("========================================");

  dht.begin();

  pinMode(RELAY_FAN_PIN, OUTPUT);
  pinMode(RELAY_LAMP_PIN, OUTPUT);
  pinMode(RELAY_BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_FAN_PIN, LOW);
  digitalWrite(RELAY_LAMP_PIN, LOW);
  digitalWrite(RELAY_BUZZER_PIN, LOW);

  pinMode(IR_SENSOR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(IR_SENSOR_PIN), irInterrupt, FALLING);

  connectWiFi();

  timeClient.begin();
  timeClient.update();

  Serial.println("Setup complete. Starting main loop...");
  Serial.println("========================================");
}

// ============================================================
//  MAIN LOOP
// ============================================================

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWiFi();
  }

  timeClient.update();

  if (now - lastSensorTime >= SENSOR_INTERVAL) {
    lastSensorTime = now;
    sendSensorData();
  }

  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  static unsigned long lastEggSend = 0;
  if (eggCount > 0 && now - lastEggSend >= 60000) {
    lastEggSend = now;
    sendEggData();
  }

  if (now - lastActuatorTime >= ACTUATOR_POLL_INTERVAL) {
    lastActuatorTime = now;
    pollActuators();
  }

  delay(500);
}
