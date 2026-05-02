'use client';

import { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

type Range = '1h' | '24h' | '7d' | '30d';

interface DataPoint {
    time: string;
    avg: number;
    min: number;
    max: number;
}

interface ChartProps {
    type: 'temperature' | 'humidity';
    forecastValue?: number | null;
    forecastLabel?: string;
}

const formatLabel = (type: 'temperature' | 'humidity', range: Range) => {
    if (range === '1h' || range === '24h') return (t: unknown) => String(t).slice(11, 16);
    return (t: unknown) => {
        const d = new Date(String(t));
        return `${d.getDate()}/${d.getMonth() + 1}`;
    };
};

const tooltipFormatter = (type: 'temperature' | 'humidity') =>
    (value: unknown) => `${Number(value ?? 0).toFixed(1)}${type === 'temperature' ? '°C' : '%'}`;

const REFRESH_INTERVAL_MS = 5000;

const getYAxisDomain = (type: 'temperature' | 'humidity') => {
    if (type === 'humidity') return [0, 100] as const;

    return [
        (dataMin: number) => Math.floor(Math.min(20, dataMin - 2)),
        (dataMax: number) => Math.ceil(Math.max(40, dataMax + 2)),
    ] as const;
};

export default function SensorChart({ type, forecastValue = null, forecastLabel = 'Pola AI 30 hari' }: ChartProps) {
    const [range, setRange] = useState<Range>('1h');
    const [data, setData] = useState<DataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        let active = true;
        let interval: number | undefined;

        const fetchData = (showLoading = false) => {
            if (showLoading) setLoading(true);
            fetch(`/api/dashboard/${type === 'temperature' ? 'temperature' : 'humidity'}-history?range=${range}`)
                .then((r) => r.json())
                .then((d) => {
                    if (!active) return;
                    setData(d.data || []);
                    setLastUpdated(new Date());
                    setLoading(false);
                })
                .catch(() => {
                    if (active) setLoading(false);
                });
        };

        fetchData(true);
        if (range === '1h' || range === '24h') {
            interval = window.setInterval(() => fetchData(false), REFRESH_INTERVAL_MS);
        }

        return () => {
            active = false;
            if (interval) window.clearInterval(interval);
        };
    }, [type, range]);

    const isTemp = type === 'temperature';
    const strokeColor = isTemp ? '#D4A017' : '#E8913A';
    const gradientId = isTemp ? 'tempGrad' : 'humGrad';
    const unit = isTemp ? '°C' : '%';
    const label = formatLabel(type, range);

    return (
        <div className="chart-card">
            <div className="chart-card-header">
                <div>
                    <div className="chart-card-title">
                        {isTemp ? '🌡️ Grafik Suhu' : '💧 Grafik Kelembapan'}
                    </div>
                    <div className="chart-card-subtitle">
                        {isTemp ? 'Suhu kandang dari DHT22' : 'Kelembapan kandang dari DHT22'}
                        {(range === '1h' || range === '24h') && lastUpdated ? ` · update ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                        {range === '30d' && forecastValue !== null ? ` · ${forecastLabel}: ${forecastValue.toFixed(1)}${unit}` : ''}
                    </div>
                </div>
                <div className="range-tabs">
                    {(['1h', '24h', '7d', '30d'] as Range[]).map((r) => (
                        <button
                            key={r}
                            className={`range-tab ${range === r ? 'active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="skeleton" style={{ height: 220, borderRadius: 10 }} />
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D0" vertical={false} />
                        <XAxis
                            dataKey="time"
                            tickFormatter={label}
                            tick={{ fontSize: 11, fill: '#9C8060' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#9C8060' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}${unit}`}
                            domain={getYAxisDomain(type)}
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#fff',
                                border: '1px solid #EDD8B8',
                                borderRadius: 10,
                                boxShadow: '0 4px 12px rgba(139,105,20,0.12)',
                                fontSize: 12,
                            }}
                            labelStyle={{ color: '#5C4A32', fontWeight: 600 }}
                            formatter={tooltipFormatter(type)}
                            labelFormatter={label}
                        />
                        {range === '30d' && forecastValue !== null && (
                            <ReferenceLine
                                y={forecastValue}
                                stroke={strokeColor}
                                strokeDasharray="4 4"
                                strokeOpacity={0.55}
                                ifOverflow="extendDomain"
                            />
                        )}
                        <Area
                            type="monotone"
                            dataKey="avg"
                            stroke={strokeColor}
                            strokeWidth={2.5}
                            fill={`url(#${gradientId})`}
                            dot={false}
                            activeDot={{ r: 5, fill: strokeColor, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
