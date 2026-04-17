import type { Actuator, Device } from '@prisma/client';
import { db } from '@/lib/db';
import SharedLayout from '@/components/layout/SharedLayout';
import SummaryCards from '@/components/dashboard/SummaryCards';
import SensorChart from '@/components/dashboard/SensorChart';
import ActuatorControls from '@/components/dashboard/ActuatorControls';
import DeviceStatus from '@/components/dashboard/DeviceStatus';
import EggMonitor from '@/components/dashboard/EggMonitor';
import DashboardClock from '@/components/dashboard/DashboardClock';
import { getOfflineTimeoutMs } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DeviceWithStatus = Device & {
  isOnline: boolean;
  lastSeen: string | null;
  rssi: number | null;
  freeHeap: number | null;
  uptime: number | null;
};

async function getDashboardData() {
  const now = new Date();
  const latest = await db.sensorReading.findFirst({
    where: {
      createdAt: { lte: now },
      temperature: { gte: 10, lte: 60 },
      humidity: { gte: 10, lte: 100 },
    },
    orderBy: { createdAt: 'desc' },
  });

  const latestGas = await db.gasReading.findFirst({
    where: { createdAt: { lte: now } },
    orderBy: { createdAt: 'desc' },
  });

  const lastUnsafeGas = await db.gasReading.findFirst({
    where: {
      gasDetected: true,
      createdAt: { lte: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const avgResult = await db.sensorReading.aggregate({
    _avg: {
      temperature: true,
      humidity: true,
    },
    where: {
      createdAt: { gte: dayAgo, lte: now },
      temperature: { gte: 10, lte: 60 },
      humidity: { gte: 10, lte: 100 },
    },
  });

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStat = await db.coopDailyStat.findFirst({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  const totalEggs = await db.eggEvent.aggregate({
    _sum: { count: true },
  });

  const recentEggsRaw = await db.eggEvent.findMany({
    where: { createdAt: { lte: now } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const recentEggs = recentEggsRaw.map(e => ({
    ...e,
    createdAt: e.createdAt.toISOString()
  }));

  const lastHB = await db.deviceHeartbeat.findFirst({
    where: { createdAt: { lte: now } },
    orderBy: { createdAt: 'desc' },
  });

  const offlineTimeoutMs = await getOfflineTimeoutMs();
  const liveReading = latest && now.getTime() - new Date(latest.createdAt).getTime() < offlineTimeoutMs
    ? latest
    : null;
  const isOnline = lastHB
    ? now.getTime() - new Date(lastHB.createdAt).getTime() < offlineTimeoutMs
    : false;

  const allDevices = await db.device.findMany({
    include: {
      heartbeats: {
        where: { createdAt: { lte: now } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const devicesWithStatus: DeviceWithStatus[] = allDevices.map((d) => {
    const hb = d.heartbeats[0];
    return {
      ...d,
      isOnline: hb ? now.getTime() - new Date(hb.createdAt).getTime() < offlineTimeoutMs : false,
      lastSeen: hb?.createdAt.toISOString() ?? null,
      rssi: hb?.rssi ?? null,
      freeHeap: hb?.freeHeap ?? null,
      uptime: hb?.uptime ?? null,
    };
  });

  const allActuators: Actuator[] = await db.actuator.findMany();

  return {
    temperature: liveReading?.temperature ?? null,
    humidity: liveReading?.humidity ?? null,
    avgTemp24h: avgResult._avg.temperature ? parseFloat(avgResult._avg.temperature.toFixed(1)) : null,
    avgHumidity24h: avgResult._avg.humidity ? parseFloat(avgResult._avg.humidity.toFixed(1)) : null,
    eggsToday: todayStat?.eggCount ?? 0,
    eggsTotal: totalEggs._sum.count ?? 0,
    gasDetected: liveReading?.gasDetected ?? false,
    gasValue: liveReading?.gasValue ?? null,
    lastGasReading: latestGas?.createdAt ?? null,
    lastUnsafeGasAt: lastUnsafeGas?.createdAt.toISOString() ?? null,
    recentEggs,
    isOnline,
    devices: devicesWithStatus,
    actuators: allActuators,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <SharedLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Dashboard Monitoring</h2>
          <p>Sistem monitoring kandang telur</p>
        </div>
        <DashboardClock />
      </div>

      <SummaryCards
        data={{
          temperature: data.temperature,
          humidity: data.humidity,
          eggsToday: data.eggsToday,
          isOnline: data.isOnline,
          avgTemp24h: data.avgTemp24h,
          avgHumidity24h: data.avgHumidity24h,
          gasDetected: data.gasDetected,
          gasValue: data.gasValue,
          lastUnsafeGasAt: data.lastUnsafeGasAt,
        }}
      />

      <div className="charts-grid">
        <SensorChart type="temperature" />
        <SensorChart type="humidity" />
      </div>

      <div className="bottom-grid">
        <ActuatorControls actuators={data.actuators} />
        <DeviceStatus devices={data.devices} />
        <EggMonitor
          data={{
            eggsToday: data.eggsToday,
            eggsTotal: data.eggsTotal,
            recentEggs: data.recentEggs,
          }}
        />
      </div>
    </SharedLayout>
  );
}
