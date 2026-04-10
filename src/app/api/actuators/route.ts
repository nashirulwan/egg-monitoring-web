import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const all = await db.actuator.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ actuators: all });
  } catch (error) {
    console.error('Actuators list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
