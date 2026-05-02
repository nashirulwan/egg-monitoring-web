import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const deviceId = 'esp32-01';
const sensorIds = ['A001', 'A002', 'B001', 'B002'] as const;
const monthlyEggTargets: Record<string, Record<(typeof sensorIds)[number], number>> = {
  '2025-10': { A001: 28, A002: 25, B001: 19, B002: 14 },
  '2025-11': { A001: 27, A002: 24, B001: 18, B002: 13 },
  '2025-12': { A001: 27, A002: 23, B001: 17, B002: 12 },
  '2026-01': { A001: 26, A002: 22, B001: 16, B002: 11 },
  '2026-02': { A001: 25, A002: 21, B001: 16, B002: 10 },
  '2026-03': { A001: 24, A002: 20, B001: 15, B002: 9 },
  '2026-04': { A001: 23, A002: 19, B001: 14, B002: 8 },
};

const sensorProfiles: Record<(typeof sensorIds)[number], {
  label: string;
  productionBias: number;
  instability: number;
}> = {
  A001: { label: 'produktif stabil', productionBias: 1.15, instability: 0.08 },
  A002: { label: 'produktif sedang', productionBias: 1.0, instability: 0.1 },
  B001: { label: 'menurun', productionBias: 0.82, instability: 0.16 },
  B002: { label: 'afkir', productionBias: 0.6, instability: 0.22 },
};

function seededNumber(seed: number, min: number, max: number) {
  const x = Math.sin(seed) * 10000;
  const fraction = x - Math.floor(x);
  return min + fraction * (max - min);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function monthStart(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function pickEggDays(total: number, totalDays: number, sensorIndex: number) {
  const days = new Set<number>();
  for (let i = 0; i < total; i += 1) {
    const day = Math.min(totalDays, Math.floor(((i + 0.5) * totalDays) / total) + 1 + (sensorIndex % 2));
    days.add(day);
  }

  return Array.from(days).sort((a, b) => a - b);
}

async function main() {
  console.log('Seeding Egg Monitoring database...');

  await db.sensorAiPrediction.deleteMany();
  await db.actuatorLog.deleteMany();
  await db.actuator.deleteMany();
  await db.eggEvent.deleteMany();
  await db.gasReading.deleteMany();
  await db.sensorReading.deleteMany();
  await db.deviceHeartbeat.deleteMany();
  await db.alert.deleteMany();
  await db.coopDailyStat.deleteMany();
  await db.coopMonthlyStat.deleteMany();
  await db.coop.deleteMany();
  await db.device.deleteMany();

  const device = await db.device.create({
    data: {
      id: deviceId,
      name: 'ESP32-Kandang-01',
      type: 'ESP32',
      location: 'Kandang Utama',
    },
  });

  const coop = await db.coop.create({
    data: {
      name: 'Kandang Utama',
      idKandang: 'kandang-01',
      status: 'active',
      age: 120,
    },
  });

  await db.actuator.createMany({
    data: [
      { id: 'act-fan-1', deviceId: device.id, name: 'Kipas 1', type: 'fan', pin: 16, state: false },
      { id: 'act-fan-2', deviceId: device.id, name: 'Kipas 2', type: 'fan', pin: 17, state: false },
      { id: 'act-lamp', deviceId: device.id, name: 'Lampu', type: 'lamp', pin: 23, state: true },
      { id: 'act-conveyor', deviceId: device.id, name: 'Motor DC Conveyor', type: 'conveyor', pin: 27, state: false },
    ],
  });

  const sensorReadings: Array<{
    deviceId: string;
    temperature: number;
    humidity: number;
    gasDetected: boolean;
    gasValue: number;
    createdAt: Date;
  }> = [];
  const gasReadings: Array<{
    deviceId: string;
    gasDetected: boolean;
    analogValue: number;
    notes: string;
    createdAt: Date;
  }> = [];
  const heartbeats: Array<{
    deviceId: string;
    rssi: number;
    freeHeap: number;
    uptime: number;
    createdAt: Date;
  }> = [];
  const eggEvents: Array<{
    deviceId: string;
    sensorId: string;
    count: number;
    notes: string;
    createdAt: Date;
  }> = [];
  const dailyStats: Array<{
    coopId: string;
    date: Date;
    eggCount: number;
    avgTemp: number;
    avgHumidity: number;
    minTemp: number;
    maxTemp: number;
  }> = [];
  const aiPredictions: Array<{
    deviceId: string;
    sensorId: string;
    targetMonth: Date;
    predictedEggs7d: number;
    predictedEggs30d: number;
    predictedMonthlyEggs: number;
    predictedStatus: string;
    confidence: number;
    afkirRiskScore: number;
    anomalyScore: number;
    anomalyLabel: string;
    modelVersion: string;
    featureSnapshot: Record<string, string | number>;
    generatedAt: Date;
  }> = [];

  let globalDay = 0;
  for (const [month, targets] of Object.entries(monthlyEggTargets)) {
    const start = monthStart(month);
    const totalDays = daysInMonth(month);
    const eggsByDay = new Map<number, number>();

    sensorIds.forEach((sensorId, sensorIndex) => {
      const target = targets[sensorId];
      const eggDays = pickEggDays(target, totalDays, sensorIndex);
      const remainingDoubleEggs = Math.max(0, target - eggDays.length);
      const profile = sensorProfiles[sensorId];

      eggDays.forEach((day, eventIndex) => {
        const count = eventIndex < remainingDoubleEggs ? 2 : 1;
        const createdAt = new Date(start);
        createdAt.setUTCDate(day);
        createdAt.setUTCHours(7 + sensorIndex * 2 + (eventIndex % 3), (eventIndex * 11) % 60, 0, 0);

        eggEvents.push({
          deviceId: device.id,
          sensorId,
          count,
          notes: `dummy ${profile.label}`,
          createdAt,
        });
        eggsByDay.set(day, (eggsByDay.get(day) ?? 0) + count);
      });
    });

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(start);
      date.setUTCDate(day);
      const temps = [];
      const hums = [];
      let lastGasDetected = false;
      let lastGasValue = 0;

      for (let hour = 0; hour < 24; hour += 2) {
        const createdAt = new Date(date);
        createdAt.setUTCHours(hour, 0, 0, 0);
        const weatherStress = seededNumber(globalDay + 200, -0.4, 0.9);
        const temp = Number((28.2 + weatherStress + Math.sin(hour / 24 * Math.PI * 2) * 2.4 + seededNumber(globalDay + hour, -0.3, 0.3)).toFixed(1));
        const humidity = Number((54 + weatherStress * 3 + Math.cos(hour / 24 * Math.PI * 2) * 4.2 + seededNumber(globalDay + hour + 40, -1.4, 1.4)).toFixed(1));
        const gasDetected = (globalDay + hour) % 19 === 0 || (globalDay + hour) % 37 === 0;
        const gasValue = Math.round(gasDetected
          ? seededNumber(globalDay + hour + 80, 1900, 2600)
          : seededNumber(globalDay + hour + 90, 220, 620));

        sensorReadings.push({
          deviceId: device.id,
          temperature: temp,
          humidity,
          gasDetected,
          gasValue,
          createdAt,
        });

        if (hour % 6 === 0 || gasDetected) {
          gasReadings.push({
            deviceId: device.id,
            gasDetected,
            analogValue: gasValue,
            notes: gasDetected ? 'dummy gas tinggi' : 'dummy gas aman',
            createdAt,
          });
        }

        heartbeats.push({
          deviceId: device.id,
          rssi: Math.round(seededNumber(globalDay + hour + 120, -68, -38)),
          freeHeap: Math.round(seededNumber(globalDay + hour + 140, 145000, 225000)),
          uptime: globalDay * 86400 + hour * 3600,
          createdAt,
        });

        temps.push(temp);
        hums.push(humidity);
        lastGasDetected = gasDetected;
        lastGasValue = gasValue;
      }

      const avg = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;
      dailyStats.push({
        coopId: coop.id,
        date,
        eggCount: eggsByDay.get(day) ?? 0,
        avgTemp: Number(avg(temps).toFixed(1)),
        avgHumidity: Number(avg(hums).toFixed(1)),
        minTemp: Math.min(...temps),
        maxTemp: Math.max(...temps),
      });
      globalDay += 1;
    }
  }

  await db.sensorReading.createMany({ data: sensorReadings });
  await db.gasReading.createMany({ data: gasReadings });
  await db.deviceHeartbeat.createMany({ data: heartbeats });
  await db.eggEvent.createMany({ data: eggEvents });
  await db.coopDailyStat.createMany({ data: dailyStats });

  const monthlyMap = new Map<string, { totalEggs: number; temps: number[]; hums: number[] }>();
  for (const stat of dailyStats) {
    const month = new Date(stat.date);
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const key = month.toISOString();
    const bucket = monthlyMap.get(key) ?? { totalEggs: 0, temps: [], hums: [] };
    bucket.totalEggs += stat.eggCount ?? 0;
    if (stat.avgTemp != null) bucket.temps.push(stat.avgTemp);
    if (stat.avgHumidity != null) bucket.hums.push(stat.avgHumidity);
    monthlyMap.set(key, bucket);
  }

  await db.coopMonthlyStat.createMany({
    data: Array.from(monthlyMap.entries()).map(([key, value]) => ({
      coopId: coop.id,
      month: new Date(key),
      totalEggs: value.totalEggs,
      avgTemp: value.temps.length
        ? Number((value.temps.reduce((sum, item) => sum + item, 0) / value.temps.length).toFixed(1))
        : null,
      avgHumidity: value.hums.length
        ? Number((value.hums.reduce((sum, item) => sum + item, 0) / value.hums.length).toFixed(1))
        : null,
      productionRate: null,
    })),
  });

  const targetMonth = new Date(Date.UTC(2026, 4, 1));
  sensorIds.forEach((sensorId, sensorIndex) => {
    const baseMonthlyTarget = monthlyEggTargets['2026-04'][sensorId];
    const profile = sensorProfiles[sensorId];
    const predictedMonthlyEggs = Number((baseMonthlyTarget * profile.productionBias * seededNumber(sensorIndex + 11, 0.95, 1.05)).toFixed(1));
    const predictedEggs30d = Number(predictedMonthlyEggs.toFixed(1));
    const predictedEggs7d = Number((predictedMonthlyEggs / 30 * 7).toFixed(1));
    const afkirRiskScore = Number(
      Math.min(
        0.98,
        Math.max(0.08, (20 - predictedMonthlyEggs) / 20 * 0.75 + profile.instability),
      ).toFixed(2),
    );
    const anomalyScore = Number((0.12 + sensorIndex * 0.16 + profile.instability).toFixed(2));
    const predictedStatus =
      predictedMonthlyEggs < 20 ? 'Afkir' : predictedMonthlyEggs < 24 ? 'Perlu Dipantau' : 'Produktif';
    const anomalyLabel = anomalyScore >= 0.45 ? 'Tinggi' : anomalyScore >= 0.28 ? 'Sedang' : 'Rendah';

    aiPredictions.push({
      deviceId: device.id,
      sensorId,
      targetMonth,
      predictedEggs7d,
      predictedEggs30d,
      predictedMonthlyEggs,
      predictedStatus,
      confidence: Number((0.84 - sensorIndex * 0.06).toFixed(2)),
      afkirRiskScore,
      anomalyScore,
      anomalyLabel,
      modelVersion: 'seed-demo-v1',
      featureSnapshot: {
        profile: profile.label,
        latestMonthlyTarget: baseMonthlyTarget,
        avgTemp7d: Number((29.4 + sensorIndex * 0.4).toFixed(1)),
        gasAlertCount7d: 2 + sensorIndex,
      },
      generatedAt: new Date('2026-05-01T00:00:00.000Z'),
    });
  });

  await db.alert.createMany({
    data: [
      {
        type: 'temperature',
        severity: 'warning',
        message: 'Suhu melebihi 39°C selama 10 menit',
        isRead: true,
        createdAt: new Date('2026-04-10T08:00:00.000Z'),
      },
      {
        type: 'humidity',
        severity: 'info',
        message: 'Kelembapan stabil di 55% selama 24 jam terakhir',
        isRead: true,
        createdAt: new Date('2026-04-11T08:00:00.000Z'),
      },
      {
        type: 'device_offline',
        severity: 'critical',
        message: 'ESP32 belum mengirim heartbeat terbaru',
        isRead: false,
        createdAt: new Date('2026-04-12T02:00:00.000Z'),
      },
    ],
  });

  await db.sensorAiPrediction.createMany({ data: aiPredictions });

  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
