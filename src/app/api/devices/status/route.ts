import { NextResponse } from 'next/server';
import { getDeviceStatuses } from '@/lib/server';

export async function GET() {
  try {
    const devices = await getDeviceStatuses();
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Device status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
