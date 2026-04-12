'use client';

import { Thermometer, Droplets, Egg, Wind } from 'lucide-react';

interface SummaryData {
    temperature: number | null;
    humidity: number | null;
    eggsToday: number;
    isOnline: boolean;
    avgTemp24h: number | null;
    avgHumidity24h: number | null;
    gasDetected: boolean;
    gasValue: number | null;
    lastUnsafeGasAt: string | null;
}

export default function SummaryCards({ data }: { data: SummaryData }) {
    const lastUnsafeGas = data.lastUnsafeGasAt
        ? new Date(data.lastUnsafeGasAt).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
        : 'belum ada';

    return (
        <div className="summary-grid">
            {/* Temperature */}
            <div className="summary-card amber">
                <div className="summary-card-header">
                    <span className="summary-card-label">Suhu Sekarang</span>
                    <div className="summary-card-icon amber">
                        <Thermometer size={18} />
                    </div>
                </div>
                <div className="summary-card-value">
                    {data.temperature !== null ? `${data.temperature.toFixed(1)}°` : '—'}
                </div>
                <div className="summary-card-sub">
                    {data.avgTemp24h !== null ? `Rata-rata 24j: ${data.avgTemp24h}°C` : 'Memuat data...'}
                </div>
            </div>

            {/* Humidity */}
            <div className="summary-card orange">
                <div className="summary-card-header">
                    <span className="summary-card-label">Kelembapan</span>
                    <div className="summary-card-icon orange">
                        <Droplets size={18} />
                    </div>
                </div>
                <div className="summary-card-value">
                    {data.humidity !== null ? `${data.humidity.toFixed(1)}%` : '—'}
                </div>
                <div className="summary-card-sub">
                    {data.avgHumidity24h !== null ? `Rata-rata 24j: ${data.avgHumidity24h}%` : 'Memuat data...'}
                </div>
            </div>

            {/* Eggs Today */}
            <div className="summary-card brown">
                <div className="summary-card-header">
                    <span className="summary-card-label">Telur Hari Ini</span>
                    <div className="summary-card-icon brown">
                        <Egg size={18} />
                    </div>
                </div>
                <div className="summary-card-value">{data.eggsToday}</div>
                <div className="summary-card-sub">butir telur terdeteksi</div>
            </div>

            {/* Gas Status */}
            <div className="summary-card green">
                <div className="summary-card-header">
                    <span className="summary-card-label">Sensor Gas</span>
                    <div className="summary-card-icon green">
                        <Wind size={18} />
                    </div>
                </div>
                <div className="summary-card-value" style={{ fontSize: '22px', marginTop: '4px' }}>
                    <span
                        className="badge"
                        style={{
                            background: data.gasDetected ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.12)',
                            color: data.gasDetected ? '#dc2626' : '#16a34a',
                            fontSize: '15px',
                            padding: '4px 14px',
                        }}
                    >
                        <span
                            className="status-dot"
                            style={{
                                display: 'inline-block',
                                background: data.gasDetected ? '#dc2626' : '#16a34a',
                            }}
                        />
                        {data.gasValue !== null ? `${data.gasValue} ADC` : '—'}
                    </span>
                </div>
                <div className="summary-card-sub">
                    Terakhir tidak aman: {lastUnsafeGas}
                </div>
            </div>
        </div>
    );
}
