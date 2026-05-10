import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type FeatureSnapshot = {
  gasAlertCount7d?: number;
  avgTemp30d?: number;
};

type PredictionRow = {
  sensorId: string;
  predictedStatus: string;
  afkirRiskScore: number;
  anomalyLabel: string | null;
  featureSnapshot: FeatureSnapshot | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || 'esp32-01';

    const latestRun = await db.sensorAiPrediction.findFirst({
      where: { deviceId },
      orderBy: { generatedAt: 'desc' },
      select: { generatedAt: true, targetMonth: true, modelVersion: true },
    });

    if (!latestRun) {
      return NextResponse.json({
        generatedAt: null,
        targetMonth: null,
        modelVersion: null,
        actions: {
          aiEnabled: false,
          warningMode: false,
          fanAssist: false,
          conveyorAssist: false,
          prioritySensors: [],
          reasons: [],
        },
      });
    }

    const predictions = (await db.sensorAiPrediction.findMany({
      where: {
        deviceId,
        generatedAt: latestRun.generatedAt,
      },
      orderBy: { sensorId: 'asc' },
      select: {
        sensorId: true,
        predictedStatus: true,
        afkirRiskScore: true,
        anomalyLabel: true,
        featureSnapshot: true,
      },
    })) as PredictionRow[];

    const anomalySensors = predictions.filter((item: PredictionRow) => item.anomalyLabel === 'Tinggi');
    const highRiskSensors = predictions.filter((item: PredictionRow) => item.afkirRiskScore >= 0.65);
    const avgTemp = predictions.length
      ? predictions.reduce((sum: number, item: PredictionRow) => sum + Number((item.featureSnapshot?.avgTemp30d) ?? 0), 0) / predictions.length
      : 0;
    const maxGasAlert7d = predictions.reduce(
      (max: number, item: PredictionRow) => Math.max(max, Number((item.featureSnapshot?.gasAlertCount7d) ?? 0)),
      0,
    );

    const fanAssist = avgTemp >= 28.5 || anomalySensors.length >= 2;
    const conveyorAssist = maxGasAlert7d >= 3 || anomalySensors.length >= 2;
    const warningMode = fanAssist || conveyorAssist || highRiskSensors.length >= 2;

    const reasons: string[] = [];
    if (avgTemp >= 28.5) reasons.push(`avgTemp30d=${avgTemp.toFixed(1)}C`);
    if (maxGasAlert7d >= 3) reasons.push(`gasAlert7d=${maxGasAlert7d}`);
    if (anomalySensors.length) reasons.push(`anomaly=${anomalySensors.map((item: PredictionRow) => item.sensorId).join(',')}`);
    if (highRiskSensors.length) reasons.push(`risk=${highRiskSensors.map((item: PredictionRow) => item.sensorId).join(',')}`);

    return NextResponse.json({
      generatedAt: latestRun.generatedAt,
      targetMonth: latestRun.targetMonth,
      modelVersion: latestRun.modelVersion,
      actions: {
        aiEnabled: true,
        warningMode,
        fanAssist,
        conveyorAssist,
        prioritySensors: Array.from(
          new Set([
            ...anomalySensors.map((item: PredictionRow) => item.sensorId),
            ...highRiskSensors.map((item: PredictionRow) => item.sensorId),
          ]),
        ),
        reasons,
      },
    });
  } catch (error) {
    console.error('AI actions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
