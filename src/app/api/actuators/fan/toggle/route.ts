import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const fan = await db.actuator.findFirst({
      where: { type: 'fan' },
    });

    if (!fan) {
      return NextResponse.json({ error: 'Fan not found' }, { status: 404 });
    }

    const newState = !fan.state;

    await db.actuator.update({
      where: { id: fan.id },
      data: { state: newState },
    });

    await db.actuatorLog.create({
      data: {
        actuatorId: fan.id,
        state: newState,
        source: 'web',
      },
    });

    return NextResponse.json({ id: fan.id, name: fan.name, state: newState });
  } catch (error) {
    console.error('Fan toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
