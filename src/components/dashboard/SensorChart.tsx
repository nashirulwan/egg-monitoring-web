'use client';

import { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Range = '24h' | '7d' | '30d';

interface DataPoint {
    time: string;
    avg: number;
    min: number;
    max: number;
}

interface ChartProps {
    type: 'temperature' | 'humidity';
}

const formatLabel = (type: 'temperature' | 'humidity', range: Range) => {
    if (range === '24h') return (t: unknown) => String(t).slice(11, 16);
    return (t: unknown) => {
        const d = new Date(String(t));
        return `${d.getDate()}/${d.getMonth() + 1}`;
    };
};

const tooltipFormatter = (type: 'temperature' | 'humidity') =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (value: any) => `${Number(value).toFixed(1)}${type === 'temperature' ? '°C' : '%'}`;

export default function SensorChart({ type }: ChartProps) {
    const [range, setRange] = useState<Range>('24h');
    const [data, setData] = useState<DataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/dashboard/${type === 'temperature' ? 'temperature' : 'humidity'}-history?range=${range}`)
            .then((r) => r.json())
            .then((d) => { setData(d.data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [type, range]);

    const isTemp = type === 'temperature';
    const strokeColor = isTemp ? '#D4A017' : '#E8913A';
    const gradientId = isTemp ? 'tempGrad' : 'humGrad';
    const gradientStart = isTemp ? '#D4A01740' : '#E8913A40';
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
                        {isTemp ? 'Suhu inkubasi (target: 37.5°C)' : 'Kelembapan kandang (target: 55%)'}
                    </div>
                </div>
                <div className="range-tabs">
                    {(['24h', '7d', '30d'] as Range[]).map((r) => (
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
                            domain={isTemp ? [35, 40] : [40, 70]}
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
