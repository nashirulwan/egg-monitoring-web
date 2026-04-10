import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const [data, total, unread] = await Promise.all([
      db.alert.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      db.alert.count(),
      db.alert.count({ where: { isRead: false } }),
    ]);

    return NextResponse.json({
      data,
      unread,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Alerts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (id) {
      await db.alert.update({
        where: { id },
        data: { isRead: true },
      });
    } else {
      await db.alert.updateMany({
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Alert update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
