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

    const updated = await db.actuator.update({
      where: { id: actuator.id },
      data: { manualOverride: false },
    });

    await db.actuatorLog.create({
      data: {
        actuatorId: actuator.id,
        state: updated.state,
        source: 'web-auto',
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      state: updated.state,
      manualOverride: updated.manualOverride,
    });
  } catch (error) {
    console.error('Actuator auto mode error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
