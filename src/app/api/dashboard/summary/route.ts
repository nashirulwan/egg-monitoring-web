import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOfflineTimeoutMs } from '@/lib/server';

export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const validSensorReading = {
      temperature: { gte: 10, lte: 60 },
      humidity: { gte: 10, lte: 100 },
    };

    const [latestReading, latestGas, lastUnsafeGas, todayStats, avgResult, lastHeartbeat, recentEggs, totalEggsResult, offlineTimeoutMs] =
      await Promise.all([
        db.sensorReading.findFirst({
          where: {
            createdAt: { lte: now },
            ...validSensorReading,
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.gasReading.findFirst({ where: { createdAt: { lte: now } }, orderBy: { createdAt: 'desc' } }),
        db.gasReading.findFirst({
          where: {
            gasDetected: true,
            createdAt: { lte: now },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.coopDailyStat.findFirst({
          where: {
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        db.sensorReading.aggregate({
          _avg: { temperature: true, humidity: true },
          _min: { temperature: true },
          _max: { temperature: true },
          where: {
            createdAt: { gte: dayAgo, lte: now },
            ...validSensorReading,
          },
        }),
        db.deviceHeartbeat.findFirst({ where: { createdAt: { lte: now } }, orderBy: { createdAt: 'desc' } }),
        db.eggEvent.findMany({
          where: { createdAt: { lte: now } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        db.eggEvent.aggregate({
          _sum: { count: true },
        }),
        getOfflineTimeoutMs(),
      ]);

    const isLatestReadingFresh = latestReading
      ? now.getTime() - new Date(latestReading.createdAt).getTime() < offlineTimeoutMs
      : false;
    const isOnline = lastHeartbeat
      ? now.getTime() - new Date(lastHeartbeat.createdAt).getTime() < offlineTimeoutMs
      : false;
    const liveReading = isLatestReadingFresh ? latestReading : null;

    return NextResponse.json({
      temperature: liveReading?.temperature ?? null,
      humidity: liveReading?.humidity ?? null,
      avgTemp24h: avgResult._avg.temperature ?? null,
      avgHumidity24h: avgResult._avg.humidity ?? null,
      minTemp24h: avgResult._min.temperature ?? null,
      maxTemp24h: avgResult._max.temperature ?? null,
      eggsToday: todayStats?.eggCount ?? 0,
      eggsTotal: totalEggsResult._sum.count ?? 0,
      gasDetected: liveReading?.gasDetected ?? false,
      gasValue: liveReading?.gasValue ?? null,
      lastGasReading: liveReading?.gasValue != null ? liveReading.createdAt : latestGas?.createdAt ?? null,
      lastUnsafeGasAt: lastUnsafeGas?.createdAt ?? null,
      isOnline,
      lastHeartbeat: lastHeartbeat?.createdAt ?? null,
      recentEggs,
    });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
