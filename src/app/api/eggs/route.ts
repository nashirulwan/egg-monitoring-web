import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where = {
      ...(from ? { createdAt: { gte: new Date(from) } } : {}),
      ...(to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              lte: new Date(to),
            },
          }
        : {}),
    };

    const [data, total, dailySummary] = await Promise.all([
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
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 30
      `),
    ]);

    return NextResponse.json({
      data,
      dailySummary: dailySummary.reverse().map((row) => ({
        ...row,
        date: row.date.toISOString().slice(0, 10),
      })),
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
