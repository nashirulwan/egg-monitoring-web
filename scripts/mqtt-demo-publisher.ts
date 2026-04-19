import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'egg-monitoring';
const DEVICE_ID = process.env.MQTT_DEVICE_ID || 'esp32-01';
const INTERVAL_MS = Number(process.env.MQTT_DEMO_INTERVAL_MS || 3000);
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `egg-demo-publisher-${Math.random().toString(16).slice(2)}`;

const eggSensorIds = ['A001', 'A002', 'B001', 'B002'];
let tick = 0;

function topic(type: 'readings' | 'heartbeat' | 'eggs') {
  return `${TOPIC_PREFIX}/${DEVICE_ID}/${type}`;
}

function publishJson(client: mqtt.MqttClient, mqttTopic: string, payload: Record<string, unknown>) {
  const message = JSON.stringify(payload);
  client.publish(mqttTopic, message, { qos: 1 }, (error) => {
    if (error) {
      console.error(`[mqtt-demo] publish failed ${mqttTopic}:`, error.message);
      return;
    }
    console.log(`[mqtt-demo] ${mqttTopic} ${message}`);
  });
}

const client = mqtt.connect(BROKER_URL, {
  clientId: CLIENT_ID,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  clean: true,
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

client.on('connect', () => {
  console.log(`[mqtt-demo] connected to ${BROKER_URL}`);
  console.log(`[mqtt-demo] publishing as ${DEVICE_ID} every ${INTERVAL_MS}ms`);

  const timer = setInterval(() => {
    tick += 1;
    const temperature = Number((26 + Math.sin(tick / 4) * 2.5).toFixed(1));
    const humidity = Number((54 + Math.cos(tick / 5) * 5).toFixed(1));
    const gasDetected = tick % 7 === 0;
    const gasValue = gasDetected ? 2100 + tick * 3 : 350 + (tick % 10) * 25;

    publishJson(client, topic('readings'), {
      deviceId: DEVICE_ID,
      temperature,
      humidity,
      gasDetected,
      gasValue,
    });

    publishJson(client, topic('heartbeat'), {
      deviceId: DEVICE_ID,
      rssi: -45 - (tick % 12),
      freeHeap: 220000 - tick * 128,
      uptime: tick * Math.round(INTERVAL_MS / 1000),
    });

    if (tick % 5 === 0) {
      publishJson(client, topic('eggs'), {
        deviceId: DEVICE_ID,
        sensorId: eggSensorIds[(tick / 5) % eggSensorIds.length],
        count: 1,
        notes: 'mqtt-demo',
      });
    }
  }, INTERVAL_MS);

  const shutdown = () => {
    console.log('[mqtt-demo] shutting down...');
    clearInterval(timer);
    client.end(true, () => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
});

client.on('error', (error) => {
  console.error('[mqtt-demo] client error:', error.message);
});
