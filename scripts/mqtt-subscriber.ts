import mqtt from 'mqtt';
import { PrismaClient, Prisma } from '@prisma/client';

type MessageType = 'readings' | 'heartbeat' | 'eggs';

type MqttPayload = {
  deviceId?: string;
  temperature?: number;
  humidity?: number;
  gasDetected?: boolean;
  gasValue?: number;
  rssi?: number;
  freeHeap?: number;
  uptime?: number;
  sensorId?: string;
  count?: number;
  notes?: string;
};

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'egg-monitoring';
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `egg-web-subscriber-${Math.random().toString(16).slice(2)}`;
const FORWARD_BASE_URL = process.env.MQTT_FORWARD_BASE_URL || '';
const API_KEY = process.env.IOT_API_KEY || '';

const TOPICS = [
  `${TOPIC_PREFIX}/+/readings`,
  `${TOPIC_PREFIX}/+/heartbeat`,
  `${TOPIC_PREFIX}/+/eggs`,
];

const db = FORWARD_BASE_URL ? null : new PrismaClient();

function getMessageType(topic: string): MessageType | null {
  const lastSegment = topic.split('/').filter(Boolean).at(-1);
  if (lastSegment === 'readings' || lastSegment === 'heartbeat' || lastSegment === 'eggs') {
    return lastSegment;
  }
  return null;
}

function parseJsonMessage(raw: Buffer): MqttPayload {
  const text = raw.toString('utf8').trim();
  if (!text) throw new Error('Empty MQTT payload');
  return JSON.parse(text) as MqttPayload;
}

function normalizePayload(topic: string, payload: MqttPayload): MqttPayload {
  const [, topicDeviceId] = topic.split('/');
  return {
    ...payload,
    deviceId: payload.deviceId || topicDeviceId,
  };
}

async function logMessage(
  topic: string,
  type: MessageType,
  payload: MqttPayload,
  status: string,
  error?: string,
) {
  if (!db) return;
  await db.mqttMessageLog.create({
    data: {
      topic,
      messageType: type,
      deviceId: payload.deviceId || null,
      payload: payload as Prisma.InputJsonObject,
      status,
      error: error || null,
    },
  });
}

async function forwardToHttp(type: MessageType, payload: MqttPayload) {
  const endpointByType: Record<MessageType, string> = {
    readings: '/api/iot/readings',
    heartbeat: '/api/iot/heartbeat',
    eggs: '/api/iot/eggs',
  };

  const res = await fetch(`${FORWARD_BASE_URL}${endpointByType[type]}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

async function saveReading(payload: MqttPayload) {
  if (!db) return;
  const { deviceId, temperature, humidity, gasDetected, gasValue } = payload;

  if (!deviceId || temperature === undefined || humidity === undefined) {
    throw new Error('readings payload requires deviceId, temperature, humidity');
  }

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  const conveyorUpdate =
    gasDetected === true
      ? db.actuator.findFirst({ where: { deviceId, type: 'conveyor' } }).then((conveyor) => {
          if (!conveyor || conveyor.state) return null;
          return db.$transaction([
            db.actuator.update({
              where: { id: conveyor.id },
              data: { state: true },
            }),
            db.actuatorLog.create({
              data: {
                actuatorId: conveyor.id,
                state: true,
                source: 'mqtt-auto-gas',
              },
            }),
          ]);
        })
      : Promise.resolve(null);

  await Promise.all([
    db.sensorReading.create({
      data: {
        deviceId,
        temperature,
        humidity,
        gasDetected: gasDetected === undefined ? null : Boolean(gasDetected),
        gasValue: typeof gasValue === 'number' ? gasValue : null,
      },
    }),
    gasDetected === undefined
      ? Promise.resolve(null)
      : db.gasReading.create({
          data: {
            deviceId,
            gasDetected: Boolean(gasDetected),
            analogValue: typeof gasValue === 'number' ? gasValue : null,
            notes: 'mqtt',
          },
        }),
    conveyorUpdate,
  ]);
}

async function saveHeartbeat(payload: MqttPayload) {
  if (!db) return;
  const { deviceId, rssi, freeHeap, uptime } = payload;

  if (!deviceId) throw new Error('heartbeat payload requires deviceId');

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  await db.deviceHeartbeat.create({
    data: {
      deviceId,
      rssi: typeof rssi === 'number' ? rssi : null,
      freeHeap: typeof freeHeap === 'number' ? freeHeap : null,
      uptime: typeof uptime === 'number' ? uptime : null,
    },
  });
}

async function saveEgg(payload: MqttPayload) {
  if (!db) return;
  const { deviceId, sensorId = 'A001', count = 1, notes } = payload;

  if (!deviceId) throw new Error('eggs payload requires deviceId');
  if (!['A001', 'A002', 'B001', 'B002'].includes(sensorId)) {
    throw new Error('sensorId must be one of A001, A002, B001, B002');
  }

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  await db.eggEvent.create({
    data: {
      deviceId,
      sensorId,
      count,
      notes: notes || 'mqtt-detected',
    },
  });
}

async function handleMessage(topic: string, raw: Buffer) {
  const type = getMessageType(topic);
  if (!type) {
    console.warn(`[mqtt] ignored unsupported topic: ${topic}`);
    return;
  }

  let payload: MqttPayload = {};
  try {
    payload = normalizePayload(topic, parseJsonMessage(raw));

    if (FORWARD_BASE_URL) {
      await forwardToHttp(type, payload);
      console.log(`[mqtt] forwarded ${type} ${payload.deviceId || '-'} from ${topic}`);
      return;
    }

    if (type === 'readings') await saveReading(payload);
    if (type === 'heartbeat') await saveHeartbeat(payload);
    if (type === 'eggs') await saveEgg(payload);

    await logMessage(topic, type, payload, 'saved');
    console.log(`[mqtt] saved ${type} ${payload.deviceId || '-'} from ${topic}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logMessage(topic, type, payload, 'error', message).catch((logError) => {
      console.error('[mqtt] failed to write error log:', logError);
    });
    console.error(`[mqtt] failed ${topic}: ${message}`);
  }
}

const client = mqtt.connect(BROKER_URL, {
  clientId: CLIENT_ID,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 15000,
});

client.on('connect', () => {
  console.log(`[mqtt] connected to ${BROKER_URL}`);
  client.subscribe(TOPICS, { qos: 1 }, (error) => {
    if (error) {
      console.error('[mqtt] subscribe failed:', error);
      return;
    }
    console.log(`[mqtt] subscribed: ${TOPICS.join(', ')}`);
    if (FORWARD_BASE_URL) {
      console.log(`[mqtt] forward mode -> ${FORWARD_BASE_URL}`);
    } else {
      console.log('[mqtt] database mode -> Prisma');
    }
  });
});

client.on('message', (topic, raw) => {
  void handleMessage(topic, raw);
});

client.on('error', (error) => {
  console.error('[mqtt] client error:', error.message);
});

async function shutdown() {
  console.log('[mqtt] shutting down...');
  client.end(true);
  if (db) await db.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
