import SharedLayout from '@/components/layout/SharedLayout';
import { db } from '@/lib/db';
import { Brain, TrendingUp, ShieldAlert, Activity } from 'lucide-react';
import type { CSSProperties } from 'react';

export const dynamic = 'force-dynamic';

const statusColors: Record<string, { badge: string; text: string }> = {
  Produktif: { badge: 'success', text: '#15803d' },
  'Perlu Dipantau': { badge: 'warning', text: '#b45309' },
  Afkir: { badge: 'danger', text: '#dc2626' },
};

const anomalyColors: Record<string, string> = {
  Rendah: '#16a34a',
  Sedang: '#d97706',
  Tinggi: '#dc2626',
};

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function PrediksiAiPage() {
  const latestRun = await db.sensorAiPrediction.findFirst({
    orderBy: { generatedAt: 'desc' },
    select: { generatedAt: true, targetMonth: true, modelVersion: true },
  });

  const predictions = latestRun
    ? await db.sensorAiPrediction.findMany({
        where: { generatedAt: latestRun.generatedAt },
        orderBy: { sensorId: 'asc' },
      })
    : [];

  const predictionRows = predictions as Array<{
    id: string;
    sensorId: string;
    predictedMonthlyEggs: number;
    predictedEggs7d: number;
    predictedStatus: string;
    confidence: number;
    afkirRiskScore: number;
    anomalyScore: number | null;
    anomalyLabel: string | null;
    featureSnapshot: unknown;
  }>;

  const totalMonthlyPrediction = predictionRows.reduce((sum, item) => sum + item.predictedMonthlyEggs, 0);
  const highRiskSensors = predictionRows.filter((item) => item.afkirRiskScore >= 0.65).length;
  const anomalySensors = predictionRows.filter((item) => item.anomalyLabel === 'Tinggi').length;
  const avgConfidence = predictions.length
    ? predictionRows.reduce((sum, item) => sum + item.confidence, 0) / predictionRows.length
    : 0;

  return (
    <SharedLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Prediksi AI</h2>
          <p>Forecast telur, risiko afkir, dan anomali sensor per ayam</p>
        </div>
      </div>

      <div className="summary-grid" style={{ marginBottom: 24 }}>
        <div className="summary-card amber">
          <div className="summary-card-header">
            <span className="summary-card-label">Prediksi 30 Hari</span>
            <div className="summary-card-icon amber"><TrendingUp size={18} /></div>
          </div>
          <div className="summary-card-value">{totalMonthlyPrediction.toFixed(1)}</div>
          <div className="summary-card-sub">total telur semua sensor</div>
        </div>
        <div className="summary-card orange">
          <div className="summary-card-header">
            <span className="summary-card-label">Risiko Afkir Tinggi</span>
            <div className="summary-card-icon orange"><ShieldAlert size={18} /></div>
          </div>
          <div className="summary-card-value">{highRiskSensors}</div>
          <div className="summary-card-sub">sensor perlu tindakan cepat</div>
        </div>
        <div className="summary-card green">
          <div className="summary-card-header">
            <span className="summary-card-label">Anomali Tinggi</span>
            <div className="summary-card-icon green"><Activity size={18} /></div>
          </div>
          <div className="summary-card-value">{anomalySensors}</div>
          <div className="summary-card-sub">berdasarkan Isolation Forest</div>
        </div>
        <div className="summary-card brown">
          <div className="summary-card-header">
            <span className="summary-card-label">Rata-rata Confidence</span>
            <div className="summary-card-icon brown"><Brain size={18} /></div>
          </div>
          <div className="summary-card-value">{toPercent(avgConfidence)}</div>
          <div className="summary-card-sub">
            {latestRun
              ? `${latestRun.modelVersion} · ${new Date(latestRun.generatedAt).toLocaleString('id-ID')}`
              : 'belum ada hasil model'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>Ringkasan Model</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              XGBoost untuk prediksi telur, Random Forest untuk status, Isolation Forest untuk anomali
            </p>
          </div>
          {latestRun && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
              Target bulan: {new Date(latestRun.targetMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        {predictions.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
            Belum ada hasil training AI. Jalankan pipeline AI lalu refresh halaman ini.
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {predictionRows.map((item) => {
            const statusStyle = statusColors[item.predictedStatus] || statusColors.Produktif;
            const anomalyColor = anomalyColors[item.anomalyLabel || 'Rendah'] || anomalyColors.Rendah;
            const feature = item.featureSnapshot as Record<string, string | number> | null;

            return (
              <div key={item.id} style={sensorCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{item.sensorId}</span>
                  <span className={`badge ${statusStyle.badge}`}>{item.predictedStatus}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {item.predictedMonthlyEggs.toFixed(1)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  prediksi telur / 30 hari
                </div>
                <div style={metricRowStyle}>
                  <span>Prediksi 7 hari</span>
                  <strong>{item.predictedEggs7d.toFixed(1)}</strong>
                </div>
                <div style={metricRowStyle}>
                  <span>Risiko afkir</span>
                  <strong>{toPercent(item.afkirRiskScore)}</strong>
                </div>
                <div style={metricRowStyle}>
                  <span>Confidence</span>
                  <strong>{toPercent(item.confidence)}</strong>
                </div>
                <div style={metricRowStyle}>
                  <span>Anomali</span>
                  <strong style={{ color: anomalyColor }}>
                    {item.anomalyLabel || 'Rendah'} {item.anomalyScore != null ? `(${item.anomalyScore.toFixed(2)})` : ''}
                  </strong>
                </div>
                {feature && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)' }}>
                    <div>Profil: {String(feature.profile || '-')}</div>
                    <div>Target April: {String(feature.latestMonthlyTarget || '-')} telur</div>
                    <div>Suhu 7 hari: {String(feature.avgTemp7d || '-')}°C</div>
                    <div>Gas tinggi 7 hari: {String(feature.gasAlertCount7d || '-')} kali</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </SharedLayout>
  );
}

const sensorCardStyle: CSSProperties = {
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
};

const metricRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};
