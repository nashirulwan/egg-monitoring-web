import { db } from '@/lib/db';
import { sensorReadings, eggEvents, deviceHeartbeats, coopDailyStats } from '@/lib/schema';
import { desc, gte, sql } from 'drizzle-orm';
import SharedLayout from '@/components/layout/SharedLayout';
import SummaryCards from '@/components/dashboard/SummaryCards';
import SensorChart from '@/components/dashboard/SensorChart';
import ActuatorControls from '@/components/dashboard/ActuatorControls';
import DeviceStatus from '@/components/dashboard/DeviceStatus';
import EggMonitor from '@/components/dashboard/EggMonitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const latest = await db.query.sensorReadings.findFirst({
    orderBy: [desc(sensorReadings.createdAt)],
  });

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const avgResult = await db
    .select({
      avgTemp: sql<number>`ROUND(AVG(temperature),1)`,
      avgHumidity: sql<number>`ROUND(AVG(humidity),1)`,
    })
    .from(sensorReadings)
    .where(gte(sensorReadings.createdAt, dayAgo));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayStat = await db.query.coopDailyStats.findFirst({
    where: (t, { eq }) => eq(t.date, todayStr),
  });

  const totalEggs = await db
    .select({ total: sql<number>`COALESCE(SUM(count),0)` })
    .from(eggEvents);

  const recentEggs = await db.query.eggEvents.findMany({
    orderBy: [desc(eggEvents.createdAt)],
    limit: 5,
  });

  const lastHB = await db.query.deviceHeartbeats.findFirst({
    orderBy: [desc(deviceHeartbeats.createdAt)],
  });
  const isOnline = lastHB
    ? Date.now() - new Date(lastHB.createdAt).getTime() < 2 * 60 * 1000
    : false;

  const allDevices = await db.query.devices.findMany();
  const devicesWithStatus = await Promise.all(
    allDevices.map(async (d) => {
      const hb = await db.query.deviceHeartbeats.findFirst({
        where: (t, { eq }) => eq(t.deviceId, d.id),
        orderBy: [desc(deviceHeartbeats.createdAt)],
      });
      return {
        ...d,
        isOnline: hb ? Date.now() - new Date(hb.createdAt).getTime() < 120000 : false,
        lastSeen: hb?.createdAt ?? null,
        rssi: hb?.rssi ?? null,
        freeHeap: hb?.freeHeap ?? null,
        uptime: hb?.uptime ?? null,
      };
    })
  );

  const allActuators = await db.query.actuators.findMany();

  return {
    temperature: latest?.temperature ?? null,
    humidity: latest?.humidity ?? null,
    avgTemp24h: avgResult[0]?.avgTemp ?? null,
    avgHumidity24h: avgResult[0]?.avgHumidity ?? null,
    eggsToday: todayStat?.eggCount ?? 0,
    eggsTotal: totalEggs[0]?.total ?? 0,
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
          <p>Sistem monitoring kandang telur — Mode Simulasi 🔬</p>
        </div>
        <div className="header-time">🕐 {timeStr}</div>
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
