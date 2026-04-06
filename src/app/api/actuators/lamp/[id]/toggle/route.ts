import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lamp = await db.actuator.findFirst({
      where: {
        id,
        type: 'lamp',
      },
    });

    if (!lamp) {
      return NextResponse.json({ error: 'Lamp not found' }, { status: 404 });
    }

    const newState = !lamp.state;

    await db.actuator.update({
      where: { id: lamp.id },
      data: { state: newState },
    });

    await db.actuatorLog.create({
      data: {
        actuatorId: lamp.id,
        state: newState,
        source: 'web',
      },
    });

    return NextResponse.json({ id: lamp.id, name: lamp.name, state: newState });
  } catch (error) {
    console.error('Lamp toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
