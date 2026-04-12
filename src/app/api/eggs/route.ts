import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

const SENSOR_IDS = ['A001', 'A002', 'B001', 'B002'] as const;
const MONTHLY_AFKIR_TARGET = 20;

function getMonthRange(monthParam: string | null) {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : fallback;
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return { month, start, end, daysInMonth };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const { month, start, end, daysInMonth } = getMonthRange(searchParams.get('month'));

    const where: Prisma.EggEventWhereInput = {
      createdAt: {
        gte: start,
        lt: end,
      },
    };

    const [data, total, dailySummaryRows, dailyBySensorRows, sensorSummaryRows] = await Promise.all([
      db.eggEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.eggEvent.count({ where }),
      db.$queryRaw<Array<{ date: Date; total: number; events: number }>>(Prisma.sql`
        SELECT
          DATE("createdAt") AS date,
          COALESCE(SUM("count"), 0)::int AS total,
          COUNT(*)::int AS events
        FROM "EggEvent"
        WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      db.$queryRaw<Array<{ date: Date; sensorId: string; total: number }>>(Prisma.sql`
        SELECT
          DATE("createdAt") AS date,
          "sensorId",
          COALESCE(SUM("count"), 0)::int AS total
        FROM "EggEvent"
        WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `),
      db.$queryRaw<Array<{ sensorId: string; monthlyTotal: number; activeDays: number; lastDetectedAt: Date | null }>>(Prisma.sql`
        WITH sensors("sensorId") AS (
          VALUES ('A001'), ('A002'), ('B001'), ('B002')
        )
        SELECT
          sensors."sensorId",
          COALESCE(SUM(e."count"), 0)::int AS "monthlyTotal",
          COUNT(DISTINCT DATE(e."createdAt"))::int AS "activeDays",
          MAX(e."createdAt") AS "lastDetectedAt"
        FROM sensors
        LEFT JOIN "EggEvent" e
          ON e."sensorId" = sensors."sensorId"
          AND e."createdAt" >= ${start}
          AND e."createdAt" < ${end}
        GROUP BY sensors."sensorId"
        ORDER BY sensors."sensorId" ASC
      `),
    ]);

    const dailySummaryByDate = new Map(
      dailySummaryRows.map((row) => [
        row.date.toISOString().slice(0, 10),
        { date: row.date.toISOString().slice(0, 10), total: row.total, events: row.events },
      ]),
    );

    const dailyByDate = new Map<string, Record<string, string | number>>();
    for (const row of dailyBySensorRows) {
      const date = row.date.toISOString().slice(0, 10);
      const item = dailyByDate.get(date) ?? {
        date,
        A001: 0,
        A002: 0,
        B001: 0,
        B002: 0,
      };
      item[row.sensorId] = row.total;
      dailyByDate.set(date, item);
    }

    const dailySummary = [];
    const dailyBySensor = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(start);
      date.setUTCDate(day);
      const key = date.toISOString().slice(0, 10);
      dailySummary.push(dailySummaryByDate.get(key) ?? { date: key, total: 0, events: 0 });
      dailyBySensor.push(
        dailyByDate.get(key) ?? {
          date: key,
          A001: 0,
          A002: 0,
          B001: 0,
          B002: 0,
        },
      );
    }

    return NextResponse.json({
      data,
      month,
      daysInMonth,
      monthlyTarget: MONTHLY_AFKIR_TARGET,
      dailySummary,
      dailyBySensor,
      sensorSummary: sensorSummaryRows.map((row) => ({
        sensorId: row.sensorId,
        monthlyTotal: row.monthlyTotal,
        activeDays: row.activeDays,
        avgPerDay: Number((row.monthlyTotal / daysInMonth).toFixed(2)),
        lastDetectedAt: row.lastDetectedAt?.toISOString() ?? null,
        status: row.monthlyTotal >= MONTHLY_AFKIR_TARGET ? 'Produktif' : 'Afkir',
      })),
      sensorIds: SENSOR_IDS,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Egg events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
