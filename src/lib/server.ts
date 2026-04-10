import { Prisma } from '@prisma/client';
import { db } from './db';

export function getRangeStart(range: string) {
  const now = new Date();
  const from = new Date(now);

  switch (range) {
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

export async function getDeviceStatuses() {
  const devices = await db.device.findMany({
    include: {
      heartbeats: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return devices.map((device) => {
    const heartbeat = device.heartbeats[0] ?? null;
    return {
      ...device,
      isOnline: heartbeat
        ? Date.now() - new Date(heartbeat.createdAt).getTime() < 2 * 60 * 1000
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
  const from = getRangeStart(range);
  const bucket =
    range === '24h'
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
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return rows.map((row) => ({
    ...row,
    time: row.time.toISOString(),
  }));
}
