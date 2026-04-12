import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, sensorId = 'A001', count = 1, notes } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
    }

    if (!['A001', 'A002', 'B001', 'B002'].includes(sensorId)) {
      return NextResponse.json({ error: 'sensorId must be one of A001, A002, B001, B002' }, { status: 400 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await db.eggEvent.create({
      data: {
        deviceId,
        sensorId,
        count,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ ok: true, sensorId });
  } catch (error) {
    console.error('Eggs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
