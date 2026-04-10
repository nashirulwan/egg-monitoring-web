# Egg Monitoring

IoT system for monitoring poultry farm conditions — temperature, humidity, egg production, and actuator control (fan, lamp, buzzer) via a web dashboard.

Live: https://egg.nashiru.me

## Architecture

```
ESP32 + sensors --HTTPS--> Cloudflare Tunnel --> Next.js API --> PostgreSQL
```

The ESP32 reads sensors and pushes data to the server. The web dashboard displays real-time data and lets users control actuators remotely.

## Repo Structure

```
firmware/          ESP32 Arduino code + wiring guide
prisma/            Database schema
src/app/api/       REST API routes (IoT, actuators, dashboard, settings)
src/app/           Next.js pages (dashboard, alerts, devices, etc.)
src/components/    React components
src/lib/           DB client, utilities
```

## Tech Stack

**Server:** Next.js 16 (App Router), TypeScript, Prisma, PostgreSQL
**Hardware:** ESP32 DevKit V1, DHT11, IR Sensor, 3ch Relay Module
**Infra:** Proxmox LXC, Tailscale, Cloudflare Tunnel

## Features

- Real-time temperature & humidity monitoring with charts
- Egg production tracking (daily/monthly stats)
- Remote actuator control (fan, lamp, buzzer) via web UI
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

### ESP32

See [firmware/README.md](firmware/README.md) for wiring diagram and flashing instructions.

The `SERVER_URL` in firmware is already set to `https://egg.nashiru.me`, so the ESP32 can connect from any network — no Tailscale needed on the device side.

## API

### IoT Endpoints (used by ESP32)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/iot/readings` | Submit sensor data |
| POST | `/api/iot/heartbeat` | Device heartbeat |
| POST | `/api/iot/eggs` | Report egg detection |

### Web API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/actuators` | List actuators |
| POST | `/api/actuators/fan/toggle` | Toggle fan |
| POST | `/api/actuators/buzzer/toggle` | Toggle buzzer |
| POST | `/api/actuators/lamp/:id/toggle` | Toggle lamp |
| GET/POST | `/api/settings` | Read/write settings |
| GET | `/api/dashboard/summary` | Dashboard summary |
| GET | `/api/alerts` | List alerts |

## License

MIT
