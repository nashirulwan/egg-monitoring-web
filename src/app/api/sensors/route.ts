import { NextRequest, NextResponse } from 'next/server';
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

    const [data, total] = await Promise.all([
      db.sensorReading.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.sensorReading.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Sensor log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
