import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, count = 1, notes } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await db.eggEvent.create({
      data: {
        deviceId,
        count,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Eggs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
