import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, gasDetected, analogValue, notes } = body;

    if (!deviceId || gasDetected === undefined) {
      return NextResponse.json({ error: 'deviceId and gasDetected required' }, { status: 400 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const reading = await db.gasReading.create({
      data: {
        deviceId,
        gasDetected: Boolean(gasDetected),
        analogValue: typeof analogValue === 'number' ? analogValue : null,
        notes: notes ?? null,
      },
    });

    let conveyorState: boolean | null = null;

    if (gasDetected) {
      const conveyor = await db.actuator.findFirst({
        where: { deviceId, type: 'conveyor' },
      });

      if (conveyor) {
        const updated = await db.actuator.update({
          where: { id: conveyor.id },
          data: { state: true },
        });

        await db.actuatorLog.create({
          data: {
            actuatorId: conveyor.id,
            state: true,
            source: 'auto-gas',
          },
        });

        conveyorState = updated.state;
      }
    }

    return NextResponse.json({ ok: true, gasReading: reading, conveyorState });
  } catch (error) {
    console.error('Gas reading error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
