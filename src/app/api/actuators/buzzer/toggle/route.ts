import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const buzzer = await db.actuator.findFirst({
      where: { type: 'buzzer' },
    });

    if (!buzzer) {
      return NextResponse.json({ error: 'Buzzer not found' }, { status: 404 });
    }

    const newState = !buzzer.state;

    await db.actuator.update({
      where: { id: buzzer.id },
      data: { state: newState },
    });

    await db.actuatorLog.create({
      data: {
        actuatorId: buzzer.id,
        state: newState,
        source: 'web',
      },
    });

    return NextResponse.json({ id: buzzer.id, name: buzzer.name, state: newState });
  } catch (error) {
    console.error('Buzzer toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
