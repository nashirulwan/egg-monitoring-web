'use client';

import { Thermometer, Droplets, Egg, Wifi } from 'lucide-react';

interface SummaryData {
    temperature: number | null;
    humidity: number | null;
    eggsToday: number;
    isOnline: boolean;
    avgTemp24h: number | null;
    avgHumidity24h: number | null;
}

export default function SummaryCards({ data }: { data: SummaryData }) {
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

            {/* Device Status */}
            <div className="summary-card green">
                <div className="summary-card-header">
                    <span className="summary-card-label">Status Device</span>
                    <div className="summary-card-icon green">
                        <Wifi size={18} />
                    </div>
                </div>
                <div className="summary-card-value" style={{ fontSize: '22px', marginTop: '4px' }}>
                    <span
                        className="badge"
                        style={{
                            background: data.isOnline ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.08)',
                            color: data.isOnline ? '#16a34a' : '#dc2626',
                            fontSize: '15px',
                            padding: '4px 14px',
                        }}
                    >
                        <span
                            className="status-dot"
                            style={{
                                display: 'inline-block',
                                background: data.isOnline ? '#16a34a' : '#dc2626',
                            }}
                        />
                        {data.isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div className="summary-card-sub">ESP32-Kandang-01</div>
            </div>
        </div>
    );
}
