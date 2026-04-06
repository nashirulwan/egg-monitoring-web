import { NextRequest, NextResponse } from 'next/server';
import { getSensorHistory } from '@/lib/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '24h';
    const data = await getSensorHistory('temperature', range);
    return NextResponse.json({ range, data });
  } catch (error) {
    console.error('Temp history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
