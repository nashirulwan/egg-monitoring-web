import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const actuator = await db.actuator.findUnique({
      where: { id },
    });

    if (!actuator) {
      return NextResponse.json({ error: 'Actuator not found' }, { status: 404 });
    }

    const newState = !actuator.state;

    await db.actuator.update({
      where: { id: actuator.id },
      data: { state: newState },
    });

    await db.actuatorLog.create({
      data: {
        actuatorId: actuator.id,
        state: newState,
        source: 'web',
      },
    });

    return NextResponse.json({ id: actuator.id, name: actuator.name, type: actuator.type, state: newState });
  } catch (error) {
    console.error('Actuator toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
