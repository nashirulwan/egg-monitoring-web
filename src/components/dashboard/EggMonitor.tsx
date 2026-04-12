'use client';

interface EggData {
    eggsToday: number;
    eggsTotal: number;
    recentEggs: Array<{ id: string; sensorId: string; count: number; createdAt: string }>;
}

export default function EggMonitor({ data }: { data: EggData }) {
    return (
        <div className="chart-card">
            <div className="chart-card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div className="chart-card-title">🥚 Monitor Telur</div>
                    <div className="chart-card-subtitle">Statistik deteksi telur</div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div className="egg-stat-box">
                    <div className="egg-stat-value">{data.eggsToday}</div>
                    <div className="egg-stat-label">Hari Ini</div>
                </div>
                <div className="egg-stat-box">
                    <div className="egg-stat-value">{data.eggsTotal}</div>
                    <div className="egg-stat-label">Total</div>
                </div>
            </div>

            {/* Recent events */}
            <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>
                Deteksi Terakhir
            </div>
            <div>
                {data.recentEggs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                        Belum ada deteksi hari ini.
                    </div>
                ) : (
                    data.recentEggs.map((e) => (
                        <div className="egg-history-item" key={e.id}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {new Date(e.createdAt).toLocaleString('id-ID', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </span>
                            <span
                                className="badge warning"
                                style={{ background: 'rgba(212,160,23,0.12)', color: 'var(--primary-dark)' }}
                            >
                                {e.sensorId} · +{e.count}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
