import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const latestRun = await db.sensorAiPrediction.findFirst({
      orderBy: { generatedAt: 'desc' },
      select: { generatedAt: true, targetMonth: true, modelVersion: true },
    });

    if (!latestRun) {
      return NextResponse.json({
        generatedAt: null,
        targetMonth: null,
        modelVersion: null,
        predictions: [],
      });
    }

    const predictions = await db.sensorAiPrediction.findMany({
      where: {
        generatedAt: latestRun.generatedAt,
      },
      orderBy: { sensorId: 'asc' },
    });

    return NextResponse.json({
      generatedAt: latestRun.generatedAt,
      targetMonth: latestRun.targetMonth,
      modelVersion: latestRun.modelVersion,
      predictions,
    });
  } catch (error) {
    console.error('AI predictions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
