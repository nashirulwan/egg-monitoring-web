import { db } from '@/lib/db';
import SharedLayout from '@/components/layout/SharedLayout';
import SummaryCards from '@/components/dashboard/SummaryCards';
import SensorChart from '@/components/dashboard/SensorChart';
import ActuatorControls from '@/components/dashboard/ActuatorControls';
import DeviceStatus from '@/components/dashboard/DeviceStatus';
import EggMonitor from '@/components/dashboard/EggMonitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const latest = await db.sensorReading.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const avgResult = await db.sensorReading.aggregate({
    _avg: {
      temperature: true,
      humidity: true,
    },
    where: {
      createdAt: { gte: dayAgo },
    },
  });

  const today = new Date();
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
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const recentEggs = recentEggsRaw.map(e => ({
    ...e,
    createdAt: e.createdAt.toISOString()
  }));

  const lastHB = await db.deviceHeartbeat.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const isOnline = lastHB
    ? Date.now() - new Date(lastHB.createdAt).getTime() < 2 * 60 * 1000
    : false;

  const allDevices = await db.device.findMany({
    include: {
      heartbeats: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const devicesWithStatus = allDevices.map((d) => {
    const hb = d.heartbeats[0];
    return {
      ...d,
      isOnline: hb ? Date.now() - new Date(hb.createdAt).getTime() < 120000 : false,
      lastSeen: hb?.createdAt ?? null,
      rssi: hb?.rssi ?? null,
      freeHeap: hb?.freeHeap ?? null,
      uptime: hb?.uptime ?? null,
    };
  });

  const allActuators = await db.actuator.findMany();

  return {
    temperature: latest?.temperature ?? null,
    humidity: latest?.humidity ?? null,
    avgTemp24h: avgResult._avg.temperature ? parseFloat(avgResult._avg.temperature.toFixed(1)) : null,
    avgHumidity24h: avgResult._avg.humidity ? parseFloat(avgResult._avg.humidity.toFixed(1)) : null,
    eggsToday: todayStat?.eggCount ?? 0,
    eggsTotal: totalEggs._sum.count ?? 0,
    recentEggs,
    isOnline,
    devices: devicesWithStatus,
    actuators: allActuators,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const timeStr = new Date().toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <SharedLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Dashboard Monitoring</h2>
          <p>Sistem monitoring kandang telur</p>
        </div>
        <div className="header-time">{timeStr}</div>
      </div>

      <SummaryCards
        data={{
          temperature: data.temperature,
          humidity: data.humidity,
          eggsToday: data.eggsToday,
          isOnline: data.isOnline,
          avgTemp24h: data.avgTemp24h,
          avgHumidity24h: data.avgHumidity24h,
        }}
      />

      <div className="charts-grid">
        <SensorChart type="temperature" />
        <SensorChart type="humidity" />
      </div>

      <div className="bottom-grid">
        <ActuatorControls actuators={data.actuators} />
        <DeviceStatus devices={data.devices as any} />
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
