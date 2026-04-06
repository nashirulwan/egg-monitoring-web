import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function main() {
  console.log('Seeding Egg Monitoring database...');

  await db.actuatorLog.deleteMany();
  await db.actuator.deleteMany();
  await db.eggEvent.deleteMany();
  await db.sensorReading.deleteMany();
  await db.deviceHeartbeat.deleteMany();
  await db.alert.deleteMany();
  await db.coopDailyStat.deleteMany();
  await db.coopMonthlyStat.deleteMany();
  await db.coop.deleteMany();
  await db.device.deleteMany();

  const device = await db.device.create({
    data: {
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
      { deviceId: device.id, name: 'Kipas Utama', type: 'fan', pin: 25, state: true },
      { deviceId: device.id, name: 'Lampu 1', type: 'lamp', pin: 26, state: true },
      { deviceId: device.id, name: 'Lampu 2', type: 'lamp', pin: 27, state: true },
      { deviceId: device.id, name: 'Lampu 3', type: 'lamp', pin: 14, state: false },
      { deviceId: device.id, name: 'Lampu 4', type: 'lamp', pin: 12, state: false },
      { deviceId: device.id, name: 'Buzzer', type: 'buzzer', pin: 13, state: false },
      { deviceId: device.id, name: 'LED Indikator', type: 'led', pin: 2, state: true },
    ],
  });

  const now = new Date();
  const sensorReadings = [];
  const heartbeats = [];
  const eggEvents = [];
  const dailyStats = [];

  for (let day = 29; day >= 0; day -= 1) {
    const baseTemp = 37.5 + randomBetween(-0.8, 0.8);
    const baseHumidity = 55 + randomBetween(-4, 4);
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - day);
    dayDate.setHours(0, 0, 0, 0);

    const temps: number[] = [];
    const hums: number[] = [];
    let dayEggs = 0;

    for (let minute = 0; minute < 1440; minute += 10) {
      const d = new Date(dayDate);
      d.setMinutes(minute);
      const hourVar = Math.sin((minute / 1440) * Math.PI * 2) * 1.2;
      const temp = parseFloat((baseTemp + hourVar + randomBetween(-0.2, 0.2)).toFixed(1));
      const hum = parseFloat((baseHumidity + hourVar * 1.5 + randomBetween(-1.5, 1.5)).toFixed(1));

      sensorReadings.push({
        deviceId: device.id,
        temperature: temp,
        humidity: hum,
        createdAt: d,
      });
      temps.push(temp);
      hums.push(hum);
    }

    for (let minute = 0; minute < 1440; minute += 5) {
      const d = new Date(dayDate);
      d.setMinutes(minute);
      heartbeats.push({
        deviceId: device.id,
        rssi: Math.floor(randomBetween(-75, -35)),
        freeHeap: Math.floor(randomBetween(120000, 230000)),
        uptime: (29 - day) * 86400 + minute * 60,
        createdAt: d,
      });
    }

    const eggs = Math.floor(randomBetween(3, 8));
    for (let i = 0; i < eggs; i += 1) {
      const d = new Date(dayDate);
      d.setHours(Math.floor(randomBetween(7, 17)), Math.floor(randomBetween(0, 60)), 0, 0);
      const count = Math.floor(randomBetween(1, 4));
      eggEvents.push({
        deviceId: device.id,
        count,
        createdAt: d,
      });
      dayEggs += count;
    }

    const avg = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;

    dailyStats.push({
      coopId: coop.id,
      date: dayDate,
      eggCount: dayEggs,
      avgTemp: parseFloat(avg(temps).toFixed(1)),
      avgHumidity: parseFloat(avg(hums).toFixed(1)),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
    });
  }

  await db.sensorReading.createMany({ data: sensorReadings });
  await db.deviceHeartbeat.createMany({ data: heartbeats });
  await db.eggEvent.createMany({ data: eggEvents });
  await db.coopDailyStat.createMany({ data: dailyStats });

  await db.deviceHeartbeat.create({
    data: {
      deviceId: device.id,
      rssi: -42,
      freeHeap: 210000,
      uptime: 2592000,
      createdAt: new Date(),
    },
  });

  const monthlyMap = new Map<string, { totalEggs: number; temps: number[]; hums: number[] }>();
  for (const stat of dailyStats) {
    const month = new Date(stat.date);
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const key = month.toISOString();
    const bucket = monthlyMap.get(key) ?? { totalEggs: 0, temps: [], hums: [] };
    bucket.totalEggs += stat.eggCount;
    if (stat.avgTemp !== null) bucket.temps.push(stat.avgTemp);
    if (stat.avgHumidity !== null) bucket.hums.push(stat.avgHumidity);
    monthlyMap.set(key, bucket);
  }

  await db.coopMonthlyStat.createMany({
    data: Array.from(monthlyMap.entries()).map(([key, value]) => ({
      coopId: coop.id,
      month: new Date(key),
      totalEggs: value.totalEggs,
      avgTemp: value.temps.length
        ? parseFloat((value.temps.reduce((sum, item) => sum + item, 0) / value.temps.length).toFixed(1))
        : null,
      avgHumidity: value.hums.length
        ? parseFloat((value.hums.reduce((sum, item) => sum + item, 0) / value.hums.length).toFixed(1))
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
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        type: 'humidity',
        severity: 'info',
        message: 'Kelembapan stabil di 55% selama 24 jam terakhir',
        isRead: true,
        createdAt: new Date(Date.now() - 86400000),
      },
      {
        type: 'device_offline',
        severity: 'critical',
        message: 'ESP32 offline selama 5 menit — sudah kembali online',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000),
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
