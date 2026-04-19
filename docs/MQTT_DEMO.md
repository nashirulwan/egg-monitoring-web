# MQTT Local Demo

Use this flow to demonstrate MQTT locally without changing the main HTTP ESP32 firmware.

## What Works

- Local Mosquitto broker on the laptop.
- MQTT subscriber bridge from this project.
- MQTT demo publisher that simulates ESP32 readings, heartbeat, and egg events.
- Data forwarded to the live web API or saved directly to the database, depending on mode.

## Terminal 1: Run Local Broker

```bash
nix --extra-experimental-features nix-command --extra-experimental-features flakes shell nixpkgs#mosquitto -c mosquitto -v -p 1883
```

Expected log:

```text
Opening ipv4 listen socket on port 1883.
Opening ipv6 listen socket on port 1883.
```

## Terminal 2: Run Subscriber Bridge

For a lab laptop demo that forwards MQTT messages to the live web server:

```bash
cd /path/to/egg-monitoring-web
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 \
MQTT_FORWARD_BASE_URL=https://egg.nashiru.me \
npm run mqtt:subscriber
```

Expected log:

```text
[mqtt] connected to mqtt://127.0.0.1:1883
[mqtt] subscribed: egg-monitoring/+/readings, egg-monitoring/+/heartbeat, egg-monitoring/+/eggs
[mqtt] forward mode -> https://egg.nashiru.me
```

## Terminal 3: Run ESP32 MQTT Simulator

```bash
cd /path/to/egg-monitoring-web
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 npm run mqtt:demo:publish
```

Optional faster demo:

```bash
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 MQTT_DEMO_INTERVAL_MS=1000 npm run mqtt:demo:publish
```

The simulator publishes:

```text
egg-monitoring/esp32-01/readings
egg-monitoring/esp32-01/heartbeat
egg-monitoring/esp32-01/eggs
```

## Check Messages Manually

Optional terminal:

```bash
nix --extra-experimental-features nix-command --extra-experimental-features flakes shell nixpkgs#mosquitto -c mosquitto_sub -h localhost -t 'egg-monitoring/#' -v
```

## Database Mode

If the app and database run on the same machine as the subscriber, you can save directly through Prisma:

```bash
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 npm run mqtt:subscriber
```

For the lab demo, bridge mode is usually simpler because it forwards to the already running website.

## Notes

- The production ESP32 firmware currently uses HTTP.
- MQTT is implemented as a comparison path through broker + subscriber + simulator.
- To make the real ESP32 use MQTT, firmware still needs a MQTT client mode.
