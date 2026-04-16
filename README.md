# Egg Monitoring

IoT system for monitoring poultry farm conditions — temperature, humidity, gas, egg production per sensor, and actuator control (fan, lamp, conveyor) via a web dashboard.

Live: https://egg.nashiru.me

## Architecture

```
ESP32 + sensors --HTTPS--> Cloudflare Tunnel --> Next.js API --> PostgreSQL
```

Optional MQTT comparison path:

```
ESP32 + sensors --MQTT--> MQTT broker --> MQTT subscriber --> PostgreSQL / HTTP API
```

The ESP32 reads sensors and pushes data to the server. The web dashboard displays real-time data and lets users control actuators remotely.

## Repo Structure

```
firmware/          ESP32 Arduino code + wiring guide
prisma/            Database schema
scripts/           Background workers such as MQTT subscriber/bridge
src/app/api/       REST API routes (IoT, actuators, dashboard, settings)
src/app/           Next.js pages (dashboard, alerts, devices, etc.)
src/components/    React components
src/lib/           DB client, utilities
```

## Tech Stack

**Server:** Next.js 16 (App Router), TypeScript, Prisma, PostgreSQL
**Hardware:** ESP32 DevKit V1, DHT11, 4 IR sensors, gas sensor, relay module
**Infra:** Proxmox LXC, Tailscale, Cloudflare Tunnel

## Features

- Real-time temperature & humidity monitoring with charts
- Egg production tracking per sensor ID (A001, A002, B001, B002)
- Remote actuator monitoring/control records for Kipas 1, Kipas 2, Lampu, and Motor DC Conveyor
- Gas detection with automatic conveyor activation
- Device heartbeat monitoring (online/offline status)
- Configurable thresholds and auto-control settings
- Alert system for critical conditions

## Quick Start

### Server

```bash
git clone https://github.com/nashirulwan/egg-monitoring-web.git
cd egg-monitoring-web
npm install

# Set DATABASE_URL in .env, then:
npx prisma db push
npm run dev
```

### MQTT Comparison Worker

The MQTT worker subscribes to MQTT topics and handles the same JSON payloads as the HTTP IoT API.

Topics:

```text
egg-monitoring/esp32-01/readings
egg-monitoring/esp32-01/heartbeat
egg-monitoring/esp32-01/eggs
```

Database mode, for a broker reachable by the server:

```bash
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 npm run mqtt:subscriber
```

Bridge mode, useful when the broker runs on a laptop during lab testing:

```bash
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 \
MQTT_FORWARD_BASE_URL=https://egg.nashiru.me \
npm run mqtt:subscriber
```

In bridge mode, MQTT messages are forwarded to the existing HTTP API. In database mode, messages are saved directly through Prisma and logged in `MqttMessageLog`.

### ESP32

See [firmware/README.md](firmware/README.md) for wiring diagram and flashing instructions.

The `SERVER_URL` in firmware is already set to `https://egg.nashiru.me`, so the ESP32 can connect from any network — no Tailscale needed on the device side.

## API

### IoT Endpoints (used by ESP32)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/iot/readings` | Submit sensor data |
| POST | `/api/iot/heartbeat` | Device heartbeat |
| POST | `/api/iot/eggs` | Report egg detection per sensorId |
| POST | `/api/iot/gas` | Report gas detection and auto-enable conveyor |

### Web API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/actuators?deviceId=esp32-01` | List actuators |
| POST | `/api/actuators/:id/toggle` | Toggle actuator by id |
| GET/POST | `/api/settings` | Read/write settings |
| GET | `/api/dashboard/summary` | Dashboard summary |
| GET | `/api/alerts` | List alerts |

## License

MIT
