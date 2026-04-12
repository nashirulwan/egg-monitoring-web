import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');
    const all = await db.actuator.findMany({
      where: deviceId ? { deviceId } : undefined,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ actuators: all });
  } catch (error) {
    console.error('Actuators list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
