import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, temperature, humidity, gasDetected, gasValue } = body;

    if (!deviceId || temperature === undefined || humidity === undefined) {
      return NextResponse.json({ error: 'deviceId, temperature, humidity required' }, { status: 400 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const conveyorUpdate =
      gasDetected === true
        ? db.actuator.findFirst({
            where: { deviceId, type: 'conveyor' },
          }).then((conveyor) => {
            if (!conveyor || conveyor.state) return null;
            return db.$transaction([
              db.actuator.update({
                where: { id: conveyor.id },
                data: { state: true },
              }),
              db.actuatorLog.create({
                data: {
                  actuatorId: conveyor.id,
                  state: true,
                  source: 'auto-gas',
                },
              }),
            ]);
          })
        : Promise.resolve(null);

    await Promise.all([
      db.sensorReading.create({
        data: {
          deviceId,
          temperature,
          humidity,
          gasDetected: gasDetected === undefined ? null : Boolean(gasDetected),
          gasValue: typeof gasValue === 'number' ? gasValue : null,
        },
      }),
      gasDetected === undefined
        ? Promise.resolve(null)
        : db.gasReading.create({
            data: {
              deviceId,
              gasDetected: Boolean(gasDetected),
              analogValue: typeof gasValue === 'number' ? gasValue : null,
            },
          }),
      conveyorUpdate,
    ]);

    return NextResponse.json({ ok: true, gasDetected: gasDetected ?? null });
  } catch (error) {
    console.error('Readings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
