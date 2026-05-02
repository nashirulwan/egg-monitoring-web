import { db } from '@/lib/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SensorId = 'A001' | 'A002' | 'B001' | 'B002';

interface DatasetRow {
  deviceId: string;
  sensorId: SensorId;
  sourceMonth: string;
  targetMonth: string;
  features: {
    sensorIndex: number;
    prevMonthlyEggs: number;
    prevEggs7d: number;
    daysWithoutEgg: number;
    avgTemp30d: number;
    avgHumidity30d: number;
    gasAlertCount30d: number;
    gasAlertCount7d: number;
    rollingEggAvg2m: number;
  };
  target: {
    monthlyEggs: number;
    status: 'Produktif' | 'Perlu Dipantau' | 'Afkir';
  };
}

interface PredictionRow {
  deviceId: string;
  sensorId: SensorId;
  sourceMonth: string;
  targetMonth: string;
  targetMonthDays: number;
  features: DatasetRow['features'];
}

const SENSOR_IDS: SensorId[] = ['A001', 'A002', 'B001', 'B002'];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function addMonth(key: string, delta: number) {
  const date = parseMonthKey(key);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return monthKey(date);
}

function daysInMonth(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function statusFromMonthlyEggs(value: number): DatasetRow['target']['status'] {
  if (value < 20) return 'Afkir';
  if (value < 24) return 'Perlu Dipantau';
  return 'Produktif';
}

async function main() {
  const outputPath = process.argv[2] || path.join(process.cwd(), 'artifacts', 'ai-dataset.json');

  const [eggEvents, sensorReadings] = await Promise.all([
    db.eggEvent.findMany({
      orderBy: { createdAt: 'asc' },
      select: { deviceId: true, sensorId: true, count: true, createdAt: true },
    }),
    db.sensorReading.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        deviceId: true,
        temperature: true,
        humidity: true,
        gasDetected: true,
        createdAt: true,
      },
    }),
  ]);

  const deviceId = eggEvents[0]?.deviceId || sensorReadings[0]?.deviceId || 'esp32-01';
  const monthlyEggs = new Map<string, Map<SensorId, number>>();
  type SensorReadingRow = (typeof sensorReadings)[number];
  const monthlyReadings = new Map<string, SensorReadingRow[]>();

  for (const sensorId of SENSOR_IDS) {
    for (const event of eggEvents) {
      const month = monthKey(event.createdAt);
      const monthBucket = monthlyEggs.get(month) ?? new Map<SensorId, number>();
      monthlyEggs.set(month, monthBucket);
      if (event.sensorId === sensorId) {
        monthBucket.set(sensorId, (monthBucket.get(sensorId) ?? 0) + event.count);
      }
    }
  }

  for (const reading of sensorReadings) {
    const month = monthKey(reading.createdAt);
    const bucket = monthlyReadings.get(month) ?? [];
    bucket.push(reading);
    monthlyReadings.set(month, bucket);
  }

  const sortedMonths = Array.from(new Set([
    ...Array.from(monthlyEggs.keys()),
    ...Array.from(monthlyReadings.keys()),
  ])).sort();

  const trainRows: DatasetRow[] = [];
  const predictionRows: PredictionRow[] = [];

  for (let i = 0; i < sortedMonths.length; i += 1) {
    const month = sortedMonths[i];
    const nextMonth = addMonth(month, 1);
    const prevMonth = addMonth(month, -1);
    const prev2Month = addMonth(month, -2);
    const monthReadings = monthlyReadings.get(month) ?? [];
    const monthEggs = monthlyEggs.get(month) ?? new Map<SensorId, number>();
    const prevMonthEggs = monthlyEggs.get(prevMonth) ?? new Map<SensorId, number>();
    const prev2MonthEggs = monthlyEggs.get(prev2Month) ?? new Map<SensorId, number>();

    const avgTemp30d = monthReadings.length
      ? monthReadings.reduce((sum: number, row: SensorReadingRow) => sum + row.temperature, 0) / monthReadings.length
      : 0;
    const avgHumidity30d = monthReadings.length
      ? monthReadings.reduce((sum: number, row: SensorReadingRow) => sum + row.humidity, 0) / monthReadings.length
      : 0;
    const gasAlertCount30d = monthReadings.filter((row: SensorReadingRow) => row.gasDetected).length;
    const last7DaysStart = daysInMonth(month) - 6;
    const gasAlertCount7d = monthReadings.filter((row: SensorReadingRow) => row.gasDetected && row.createdAt.getUTCDate() >= last7DaysStart).length;

    for (const [sensorIndex, sensorId] of SENSOR_IDS.entries()) {
      const prevMonthlyEggs = monthEggs.get(sensorId) ?? 0;
      const rollingEggAvg2m = ((monthEggs.get(sensorId) ?? 0) + (prevMonthEggs.get(sensorId) ?? 0)) / 2;
      const prevEggs7d = eggEvents
        .filter((event) => event.sensorId === sensorId && monthKey(event.createdAt) === month && event.createdAt.getUTCDate() >= last7DaysStart)
        .reduce((sum: number, event) => sum + event.count, 0);

      const lastEggDate = eggEvents
        .filter((event) => event.sensorId === sensorId && monthKey(event.createdAt) === month)
        .at(-1)?.createdAt;
      const daysWithoutEgg = lastEggDate
        ? Math.max(0, daysInMonth(month) - lastEggDate.getUTCDate())
        : daysInMonth(month);

      const features: DatasetRow['features'] = {
        sensorIndex,
        prevMonthlyEggs,
        prevEggs7d,
        daysWithoutEgg,
        avgTemp30d: Number(avgTemp30d.toFixed(2)),
        avgHumidity30d: Number(avgHumidity30d.toFixed(2)),
        gasAlertCount30d,
        gasAlertCount7d,
        rollingEggAvg2m: Number((((prevMonthlyEggs + (prev2MonthEggs.get(sensorId) ?? 0)) / 2) || rollingEggAvg2m).toFixed(2)),
      };

      const nextValue = (monthlyEggs.get(nextMonth) ?? new Map<SensorId, number>()).get(sensorId);
      if (nextValue != null) {
        trainRows.push({
          deviceId,
          sensorId,
          sourceMonth: month,
          targetMonth: nextMonth,
          features,
          target: {
            monthlyEggs: nextValue,
            status: statusFromMonthlyEggs(nextValue),
          },
        });
      }

      if (i === sortedMonths.length - 1) {
        predictionRows.push({
          deviceId,
          sensorId,
          sourceMonth: month,
          targetMonth: nextMonth,
          targetMonthDays: daysInMonth(nextMonth),
          features,
        });
      }
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        deviceId,
        months: sortedMonths,
        trainRows,
        predictionRows,
      },
      null,
      2,
    ),
  );

  console.log(`AI dataset exported to ${outputPath}`);
  console.log(`Train rows: ${trainRows.length}`);
  console.log(`Prediction rows: ${predictionRows.length}`);
}

main()
  .catch((error) => {
    console.error('AI dataset export failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
