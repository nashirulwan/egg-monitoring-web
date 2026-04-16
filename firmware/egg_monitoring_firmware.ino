/*
 * EGG MONITORING & CONTROL - ESP32 FIRMWARE
 *
 * Sensor:
 *   - DHT22        -> suhu & kelembapan
 *   - 4 IR sensor  -> hitung telur per ayam/sensor
 *   - MQ gas       -> deteksi gas/kotoran, trigger conveyor
 *
 * Aktuator via relay 4-channel:
 *   - Kipas 1, Kipas 2, Lampu, Motor DC conveyor
 *
 * Server API:
 *   POST /api/iot/readings  -> suhu, kelembapan, gas optional
 *   POST /api/iot/heartbeat -> status device
 *   POST /api/iot/eggs      -> telur per sensorId
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "https://your-domain.com";
const char* DEVICE_ID     = "esp32-01";

const unsigned long SENSOR_INTERVAL = 10000;
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long EGG_SEND_INTERVAL = 60000;
const unsigned long HTTP_TIMEOUT = 10000;
const float FAN_ON_TEMP = 28.0;
const float LAMP_ON_TEMP = 28.0;
const float MIN_VALID_TEMP = 10.0;
const float MAX_VALID_TEMP = 60.0;
const float MIN_VALID_HUMIDITY = 10.0;
const float MAX_VALID_HUMIDITY = 100.0;

#define DHT_PIN 4
#define DHT_TYPE DHT22

#define EGG_SENSOR_1_PIN 18
#define EGG_SENSOR_2_PIN 19
#define EGG_SENSOR_3_PIN 21
#define EGG_SENSOR_4_PIN 22

#define GAS_SENSOR_PIN 34
#define GAS_THRESHOLD 1800

#define RELAY_FAN_1_PIN 16
#define RELAY_FAN_2_PIN 17
#define RELAY_LAMP_PIN 23
#define RELAY_CONVEYOR_PIN 27

DHT dht(DHT_PIN, DHT_TYPE);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000);

const char* EGG_SENSOR_IDS[4] = { "A001", "A002", "B001", "B002" };
volatile int eggCounts[4] = { 0, 0, 0, 0 };
volatile unsigned long lastEggTriggers[4] = { 0, 0, 0, 0 };
const unsigned long IR_DEBOUNCE_MS = 1000;

unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastEggSendTime = 0;

void IRAM_ATTR handleEggSensor(int index) {
  unsigned long now = millis();
  if (now - lastEggTriggers[index] > IR_DEBOUNCE_MS) {
    lastEggTriggers[index] = now;
    eggCounts[index]++;
  }
}

void IRAM_ATTR eggSensor1Interrupt() { handleEggSensor(0); }
void IRAM_ATTR eggSensor2Interrupt() { handleEggSensor(1); }
void IRAM_ATTR eggSensor3Interrupt() { handleEggSensor(2); }
void IRAM_ATTR eggSensor4Interrupt() { handleEggSensor(3); }

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
    return;
  }

  Serial.println("\nWiFi connection FAILED, restarting...");
  ESP.restart();
}

int sendPost(const char* endpoint, const char* jsonBody) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return -1;
  }

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, String(SERVER_URL) + String(endpoint))) {
    Serial.printf("  [%s] HTTP begin FAILED\n", endpoint);
    return -2;
  }

  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.printf("  [%s] HTTP %d -> %s\n", endpoint, httpCode, payload.c_str());
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
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, String(SERVER_URL) + String(endpoint))) {
    Serial.printf("  [GET %s] HTTP begin FAILED\n", endpoint);
    return -2;
  }

  http.setTimeout(HTTP_TIMEOUT);

  int httpCode = http.GET();

  if (httpCode > 0) {
    response = http.getString();
  } else {
    Serial.printf("  [GET %s] HTTP Error: %s\n", endpoint, http.errorToString(httpCode).c_str());
  }

  http.end();
  return httpCode;
}

void sendSensorData() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int gasValue = analogRead(GAS_SENSOR_PIN);
  bool gasDetected = gasValue >= GAS_THRESHOLD;

  if (isnan(temp) || isnan(hum)) {
    Serial.println("  DHT22 read FAILED, skipping sensor report");
    return;
  }

  if (temp < MIN_VALID_TEMP || temp > MAX_VALID_TEMP || hum < MIN_VALID_HUMIDITY || hum > MAX_VALID_HUMIDITY) {
    Serial.printf("  DHT22 invalid value -> temp: %.1f C, hum: %.1f%%, skipping sensor report\n", temp, hum);
    return;
  }

  bool fansOn = temp > FAN_ON_TEMP;
  bool lampOn = temp < LAMP_ON_TEMP;
  bool conveyorOn = gasDetected;

  digitalWrite(RELAY_FAN_1_PIN, fansOn ? HIGH : LOW);
  digitalWrite(RELAY_FAN_2_PIN, fansOn ? HIGH : LOW);
  digitalWrite(RELAY_LAMP_PIN, lampOn ? HIGH : LOW);
  digitalWrite(RELAY_CONVEYOR_PIN, conveyorOn ? HIGH : LOW);

  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["gasDetected"] = gasDetected;
  doc["gasValue"] = gasValue;

  char jsonBuf[192];
  serializeJson(doc, jsonBuf);

  Serial.printf("  Sensor -> temp: %.1f C, hum: %.1f%%, gas: %d (%s)\n",
                temp, hum, gasValue, gasDetected ? "DETECTED" : "safe");
  Serial.printf("  Auto -> Fan1:%s Fan2:%s Lamp:%s Conveyor:%s\n",
                fansOn ? "ON" : "OFF",
                fansOn ? "ON" : "OFF",
                lampOn ? "ON" : "OFF",
                conveyorOn ? "ON" : "OFF");
  sendPost("/api/iot/readings", jsonBuf);

  // /api/iot/readings already records gas and auto-enables conveyor when gasDetected is true.
}

void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = (unsigned long)(millis() / 1000);

  char jsonBuf[128];
  serializeJson(doc, jsonBuf);

  Serial.printf("  Heartbeat -> RSSI: %d, Heap: %lu, Uptime: %lus\n",
                WiFi.RSSI(), ESP.getFreeHeap(), (unsigned long)(millis() / 1000));
  sendPost("/api/iot/heartbeat", jsonBuf);
}

void sendEggData() {
  for (int i = 0; i < 4; i++) {
    int count;

    noInterrupts();
    count = eggCounts[i];
    eggCounts[i] = 0;
    interrupts();

    if (count == 0) continue;

    StaticJsonDocument<160> doc;
    doc["deviceId"] = DEVICE_ID;
    doc["sensorId"] = EGG_SENSOR_IDS[i];
    doc["count"] = count;
    doc["notes"] = "auto-detected";

    char jsonBuf[160];
    serializeJson(doc, jsonBuf);

    Serial.printf("  Eggs -> sensor: %s, count: %d\n", EGG_SENSOR_IDS[i], count);
    int httpCode = sendPost("/api/iot/eggs", jsonBuf);
    if (httpCode < 200 || httpCode >= 300) {
      noInterrupts();
      eggCounts[i] += count;
      interrupts();
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  EGG MONITORING ESP32 - Starting...");
  Serial.println("========================================");

  dht.begin();

  pinMode(RELAY_FAN_1_PIN, OUTPUT);
  pinMode(RELAY_FAN_2_PIN, OUTPUT);
  pinMode(RELAY_LAMP_PIN, OUTPUT);
  pinMode(RELAY_CONVEYOR_PIN, OUTPUT);
  digitalWrite(RELAY_FAN_1_PIN, LOW);
  digitalWrite(RELAY_FAN_2_PIN, LOW);
  digitalWrite(RELAY_LAMP_PIN, LOW);
  digitalWrite(RELAY_CONVEYOR_PIN, LOW);

  pinMode(EGG_SENSOR_1_PIN, INPUT_PULLUP);
  pinMode(EGG_SENSOR_2_PIN, INPUT_PULLUP);
  pinMode(EGG_SENSOR_3_PIN, INPUT_PULLUP);
  pinMode(EGG_SENSOR_4_PIN, INPUT_PULLUP);
  analogReadResolution(12);
  pinMode(GAS_SENSOR_PIN, INPUT);

  attachInterrupt(digitalPinToInterrupt(EGG_SENSOR_1_PIN), eggSensor1Interrupt, FALLING);
  attachInterrupt(digitalPinToInterrupt(EGG_SENSOR_2_PIN), eggSensor2Interrupt, FALLING);
  attachInterrupt(digitalPinToInterrupt(EGG_SENSOR_3_PIN), eggSensor3Interrupt, FALLING);
  attachInterrupt(digitalPinToInterrupt(EGG_SENSOR_4_PIN), eggSensor4Interrupt, FALLING);

  connectWiFi();

  timeClient.begin();
  timeClient.update();

  sendHeartbeat();
  sendSensorData();
  lastHeartbeatTime = millis();
  lastSensorTime = millis();

  Serial.println("Setup complete. Starting main loop...");
  Serial.println("========================================");
}

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

  if (now - lastEggSendTime >= EGG_SEND_INTERVAL) {
    lastEggSendTime = now;
    sendEggData();
  }

  delay(500);
}
