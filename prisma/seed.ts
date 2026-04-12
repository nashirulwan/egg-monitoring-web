import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const deviceId = 'esp32-01';
const sensorIds = ['A001', 'A002', 'B001', 'B002'] as const;
const monthlyEggTargets: Record<string, Record<(typeof sensorIds)[number], number>> = {
  '2025-12': { A001: 25, A002: 22, B001: 14, B002: 24 },
  '2026-01': { A001: 26, A002: 23, B001: 12, B002: 18 },
  '2026-02': { A001: 21, A002: 20, B001: 8, B002: 22 },
  '2026-03': { A001: 24, A002: 19, B001: 10, B002: 25 },
  '2026-04': { A001: 23, A002: 21, B001: 7, B002: 16 },
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
      { id: 'act-lamp', deviceId: device.id, name: 'Lampu', type: 'lamp', pin: 18, state: true },
      { id: 'act-buzzer', deviceId: device.id, name: 'Buzzer', type: 'buzzer', pin: 19, state: false },
      { id: 'act-conveyor', deviceId: device.id, name: 'Conveyor', type: 'conveyor', pin: 21, state: false },
    ],
  });

  const sensorReadings: Prisma.SensorReadingCreateManyInput[] = [];
  const gasReadings: Prisma.GasReadingCreateManyInput[] = [];
  const heartbeats: Prisma.DeviceHeartbeatCreateManyInput[] = [];
  const eggEvents: Prisma.EggEventCreateManyInput[] = [];
  const dailyStats: Prisma.CoopDailyStatCreateManyInput[] = [];

  let globalDay = 0;
  for (const [month, targets] of Object.entries(monthlyEggTargets)) {
    const start = monthStart(month);
    const totalDays = daysInMonth(month);
    const eggsByDay = new Map<number, number>();

    sensorIds.forEach((sensorId, sensorIndex) => {
      const target = targets[sensorId];
      const eggDays = pickEggDays(target, totalDays, sensorIndex);
      const remainingDoubleEggs = target - eggDays.length;

      eggDays.forEach((day, eventIndex) => {
        const count = eventIndex < remainingDoubleEggs ? 2 : 1;
        const createdAt = new Date(start);
        createdAt.setUTCDate(day);
        createdAt.setUTCHours(7 + sensorIndex * 2 + (eventIndex % 3), (eventIndex * 11) % 60, 0, 0);

        eggEvents.push({
          deviceId: device.id,
          sensorId,
          count,
          notes: target < 20 ? 'dummy afkir' : 'dummy produktif',
          createdAt,
        });
        eggsByDay.set(day, (eggsByDay.get(day) ?? 0) + count);
      });
    });

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(start);
      date.setUTCDate(day);
      const baseTemp = 37.3 + seededNumber(globalDay + 10, -0.5, 0.7);
      const baseHumidity = 55 + seededNumber(globalDay + 20, -4, 4);
      const temps = [];
      const hums = [];
      let lastGasDetected = false;
      let lastGasValue = 0;

      for (let hour = 0; hour < 24; hour += 2) {
        const createdAt = new Date(date);
        createdAt.setUTCHours(hour, 0, 0, 0);
        const temp = Number((baseTemp + Math.sin(hour / 24 * Math.PI * 2) * 0.8 + seededNumber(globalDay + hour, -0.2, 0.2)).toFixed(1));
        const humidity = Number((baseHumidity + Math.cos(hour / 24 * Math.PI * 2) * 1.7 + seededNumber(globalDay + hour + 40, -1, 1)).toFixed(1));
        const gasDetected = (globalDay + hour) % 47 === 0 || (globalDay + hour) % 83 === 0;
        const gasValue = Math.round(gasDetected
          ? seededNumber(globalDay + hour + 80, 680, 880)
          : seededNumber(globalDay + hour + 90, 180, 430));

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

      if (month === '2026-04' && day === 30) {
        sensorReadings.push({
          deviceId: device.id,
          temperature: 37.6,
          humidity: 56.2,
          gasDetected: lastGasDetected,
          gasValue: lastGasValue,
          createdAt: new Date('2026-04-30T23:50:00.000Z'),
        });
      }

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
