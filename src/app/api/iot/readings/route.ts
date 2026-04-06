import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, temperature, humidity } = body;

    if (!deviceId || temperature === undefined || humidity === undefined) {
      return NextResponse.json({ error: 'deviceId, temperature, humidity required' }, { status: 400 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await db.sensorReading.create({
      data: {
        deviceId,
        temperature,
        humidity,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Readings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
