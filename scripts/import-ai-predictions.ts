import { db } from '@/lib/db';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface PredictionPayload {
  generatedAt: string;
  targetMonth: string;
  modelVersion: string;
  predictions: Array<{
    deviceId: string;
    sensorId: string;
    predictedEggs7d: number;
    predictedEggs30d: number;
    predictedMonthlyEggs: number;
    predictedStatus: string;
    confidence: number;
    afkirRiskScore: number;
    anomalyScore: number | null;
    anomalyLabel: string | null;
    featureSnapshot: Record<string, string | number | null>;
  }>;
}

async function main() {
  const inputPath = process.argv[2] || path.join(process.cwd(), 'artifacts', 'ai-predictions.json');
  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw) as PredictionPayload;

  const targetMonth = new Date(payload.targetMonth);
  const generatedAt = new Date(payload.generatedAt);

  await db.sensorAiPrediction.deleteMany({
    where: {
      targetMonth,
    },
  });

  if (payload.predictions.length > 0) {
    await db.sensorAiPrediction.createMany({
      data: payload.predictions.map((item) => ({
        deviceId: item.deviceId,
        sensorId: item.sensorId,
        targetMonth,
        predictedEggs7d: item.predictedEggs7d,
        predictedEggs30d: item.predictedEggs30d,
        predictedMonthlyEggs: item.predictedMonthlyEggs,
        predictedStatus: item.predictedStatus,
        confidence: item.confidence,
        afkirRiskScore: item.afkirRiskScore,
        anomalyScore: item.anomalyScore,
        anomalyLabel: item.anomalyLabel,
        modelVersion: payload.modelVersion,
        featureSnapshot: item.featureSnapshot,
        generatedAt,
      })),
    });
  }

  await mkdir(path.join(process.cwd(), 'artifacts'), { recursive: true });
  console.log(`Imported ${payload.predictions.length} AI predictions for ${targetMonth.toISOString()}`);
}

main()
  .catch((error) => {
    console.error('AI prediction import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
