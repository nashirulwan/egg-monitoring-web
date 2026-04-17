import { Prisma } from '@prisma/client';
import { db } from './db';

export function getRangeStart(range: string) {
  const now = new Date();
  const from = new Date(now);

  switch (range) {
    case '1h':
      from.setHours(from.getHours() - 1);
      return from;
    case '7d':
      from.setDate(from.getDate() - 7);
      return from;
    case '30d':
      from.setDate(from.getDate() - 30);
      return from;
    default:
      from.setHours(from.getHours() - 24);
      return from;
  }
}

export async function getOfflineTimeoutMs() {
  const setting = await db.setting.findUnique({
    where: { key: 'offline_timeout' },
  });
  const minutes = Number(setting?.value ?? 2);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 2;
  return safeMinutes * 60 * 1000;
}

export async function getDeviceStatuses() {
  const now = new Date();
  const [devices, offlineTimeoutMs] = await Promise.all([
    db.device.findMany({
      include: {
        heartbeats: {
          where: { createdAt: { lte: now } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    getOfflineTimeoutMs(),
  ]);

  return devices.map((device) => {
    const heartbeat = device.heartbeats[0] ?? null;
    return {
      ...device,
      isOnline: heartbeat
        ? now.getTime() - new Date(heartbeat.createdAt).getTime() < offlineTimeoutMs
        : false,
      lastSeen: heartbeat?.createdAt ?? null,
      rssi: heartbeat?.rssi ?? null,
      freeHeap: heartbeat?.freeHeap ?? null,
      uptime: heartbeat?.uptime ?? null,
    };
  });
}

export async function getSensorHistory(
  metric: 'temperature' | 'humidity',
  range: string,
) {
  const now = new Date();
  const from = getRangeStart(range);
  const bucket =
    range === '1h'
      ? Prisma.raw(`date_trunc('minute', "createdAt")`)
      : range === '24h'
      ? Prisma.raw(`date_trunc('hour', "createdAt")`)
      : Prisma.raw(`date_trunc('day', "createdAt")`);
  const column =
    metric === 'temperature'
      ? Prisma.raw(`"temperature"`)
      : Prisma.raw(`"humidity"`);

  const rows = await db.$queryRaw<
    Array<{
      time: Date;
      avg: number | null;
      min: number | null;
      max: number | null;
    }>
  >(Prisma.sql`
    SELECT
      ${bucket} AS time,
      ROUND(AVG(${column})::numeric, 1) AS avg,
      ROUND(MIN(${column})::numeric, 1) AS min,
      ROUND(MAX(${column})::numeric, 1) AS max
    FROM "SensorReading"
    WHERE "createdAt" >= ${from}
      AND "createdAt" <= ${now}
      AND "temperature" BETWEEN 10 AND 60
      AND "humidity" BETWEEN 10 AND 100
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return rows.map((row) => ({
    ...row,
    time: row.time.toISOString(),
  }));
}
