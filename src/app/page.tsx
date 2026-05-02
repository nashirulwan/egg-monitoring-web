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
import { Brain, AlertTriangle, TrendingUp } from 'lucide-react';

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
  const latestPredictionRun = await db.sensorAiPrediction.findFirst({
    orderBy: { generatedAt: 'desc' },
    select: { generatedAt: true, targetMonth: true, modelVersion: true },
  });
  const aiPredictions = latestPredictionRun
    ? await db.sensorAiPrediction.findMany({
        where: { generatedAt: latestPredictionRun.generatedAt },
        orderBy: { sensorId: 'asc' },
      })
    : [];

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
    aiPredictions,
    aiGeneratedAt: latestPredictionRun?.generatedAt ?? null,
    aiTargetMonth: latestPredictionRun?.targetMonth ?? null,
    aiModelVersion: latestPredictionRun?.modelVersion ?? null,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const totalAiMonthly = data.aiPredictions.reduce((sum, item) => sum + item.predictedMonthlyEggs, 0);
  const aiHighRisk = data.aiPredictions.filter((item) => item.afkirRiskScore >= 0.65);
  const aiAnomaly = data.aiPredictions.filter((item) => item.anomalyLabel === 'Tinggi');

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

      {data.aiPredictions.length > 0 && (
        <div className="summary-grid" style={{ marginTop: 18, marginBottom: 24 }}>
          <div className="summary-card brown">
            <div className="summary-card-header">
              <span className="summary-card-label">Perkiraan Telur AI</span>
              <div className="summary-card-icon brown"><TrendingUp size={18} /></div>
            </div>
            <div className="summary-card-value">{totalAiMonthly.toFixed(1)}</div>
            <div className="summary-card-sub">
              prediksi total {data.aiTargetMonth
                ? new Date(data.aiTargetMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                : 'bulan target'}
            </div>
          </div>
          <div className="summary-card orange">
            <div className="summary-card-header">
              <span className="summary-card-label">Sensor Risiko Tinggi</span>
              <div className="summary-card-icon orange"><AlertTriangle size={18} /></div>
            </div>
            <div className="summary-card-value">{aiHighRisk.length}</div>
            <div className="summary-card-sub">
              {aiHighRisk.length ? aiHighRisk.map((item) => item.sensorId).join(', ') : 'belum ada sensor kritis'}
            </div>
          </div>
          <div className="summary-card green">
            <div className="summary-card-header">
              <span className="summary-card-label">Insight AI</span>
              <div className="summary-card-icon green"><Brain size={18} /></div>
            </div>
            <div className="summary-card-value">{aiAnomaly.length}</div>
            <div className="summary-card-sub">
              anomali tinggi · model {data.aiModelVersion ?? '-'}
            </div>
          </div>
        </div>
      )}

      <div className="charts-grid">
        <SensorChart type="temperature" />
        <SensorChart type="humidity" />
      </div>

      {data.aiPredictions.length > 0 && (
        <div className="card" style={{ marginTop: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Perkiraan AI Per Sensor</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Prediksi telur bulanan, status, dan risiko afkir langsung dari data histori
              </p>
            </div>
            {data.aiGeneratedAt && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                update {new Date(data.aiGeneratedAt).toLocaleString('id-ID')}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {data.aiPredictions.map((item) => (
              <div key={item.id} style={predictionCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{item.sensorId}</strong>
                  <span className={`badge ${item.predictedStatus === 'Produktif' ? 'success' : item.predictedStatus === 'Afkir' ? 'danger' : 'warning'}`}>
                    {item.predictedStatus}
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{item.predictedMonthlyEggs.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>perkiraan telur / 30 hari</div>
                <div style={predictionMetricStyle}>
                  <span>Risiko afkir</span>
                  <strong>{Math.round(item.afkirRiskScore * 100)}%</strong>
                </div>
                <div style={predictionMetricStyle}>
                  <span>Anomali</span>
                  <strong>{item.anomalyLabel ?? 'Rendah'}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

const predictionCardStyle = {
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
};

const predictionMetricStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};
