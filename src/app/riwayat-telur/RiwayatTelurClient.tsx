'use client';

import { useState, useEffect, useCallback } from 'react';
import { Egg, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EggEvent {
    id: string;
    sensorId: string;
    count: number;
    notes: string | null;
    createdAt: string;
}

interface DailySummary {
    date: string;
    total: number;
    events: number;
}

interface DailyBySensor {
    date: string;
    A001: number;
    A002: number;
    B001: number;
    B002: number;
}

interface SensorSummary {
    sensorId: string;
    monthlyTotal: number;
    activeDays: number;
    avgPerDay: number;
    lastDetectedAt: string | null;
    status: 'Produktif' | 'Afkir';
}

const sensorColors: Record<string, string> = {
    A001: '#D4A017',
    A002: '#E8913A',
    B001: '#16A34A',
    B002: '#2563EB',
};

const monthOptions = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

export default function RiwayatTelurClient() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => String(2025 + i));
    const [eggs, setEggs] = useState<EggEvent[]>([]);
    const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
    const [dailyBySensor, setDailyBySensor] = useState<DailyBySensor[]>([]);
    const [sensorSummary, setSensorSummary] = useState<SensorSummary[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [month, setMonth] = useState(currentMonth);
    const [daysInMonth, setDaysInMonth] = useState(30);
    const [monthlyTarget, setMonthlyTarget] = useState(20);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true);
        const res = await fetch(`/api/eggs?page=${page}&limit=25&month=${month}`);
        const json = await res.json();
        setEggs(json.data || []);
        setDailySummary(json.dailySummary || []);
        setDailyBySensor(json.dailyBySensor || []);
        setSensorSummary(json.sensorSummary || []);
        setDaysInMonth(json.daysInMonth || 30);
        setMonthlyTarget(json.monthlyTarget || 20);
        setPagination(json.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
        setLoading(false);
    }, [month]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void fetchData();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [fetchData]);

    const totalEggs = dailySummary.reduce((sum, d) => sum + d.total, 0);
    const avgPerDay = daysInMonth > 0 ? (totalEggs / daysInMonth).toFixed(2) : '0';
    const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
    });
    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Riwayat Telur</h2>
                    <p>Data produksi telur bulanan dan riwayat deteksi</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                        value={month.slice(5, 7)}
                        onChange={(e) => setMonth(`${month.slice(0, 4)}-${e.target.value}`)}
                        style={monthInputStyle}
                    >
                        {monthOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        value={month.slice(0, 4)}
                        onChange={(e) => setMonth(`${e.target.value}-${month.slice(5, 7)}`)}
                        style={monthInputStyle}
                    >
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
                <div className="summary-card amber">
                    <div className="summary-card-header">
                        <span className="summary-card-label">Total Bulan Ini</span>
                        <div className="summary-card-icon amber"><Egg size={18} /></div>
                    </div>
                    <div className="summary-card-value">{totalEggs}</div>
                    <div className="summary-card-sub">{monthLabel}</div>
                </div>
                <div className="summary-card orange">
                    <div className="summary-card-header">
                        <span className="summary-card-label">Rata-rata / Hari</span>
                        <div className="summary-card-icon orange"><Egg size={18} /></div>
                    </div>
                    <div className="summary-card-value">{avgPerDay}</div>
                    <div className="summary-card-sub">berdasarkan {daysInMonth} hari</div>
                </div>
                <div className="summary-card brown">
                    <div className="summary-card-header">
                        <span className="summary-card-label">Total Event</span>
                        <div className="summary-card-icon brown"><Egg size={18} /></div>
                    </div>
                    <div className="summary-card-value">{pagination.total}</div>
                    <div className="summary-card-sub">deteksi tercatat</div>
                </div>
            </div>

            <div className="chart-card" style={{ marginBottom: 24 }}>
                <div className="chart-card-header" style={{ marginBottom: 16 }}>
                    <div>
                        <div className="chart-card-title">Status Produktivitas Sensor</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {sensorSummary.map((sensor) => (
                        <div key={sensor.sensorId} style={sensorCardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontWeight: 800, color: sensorColors[sensor.sensorId] }}>{sensor.sensorId}</span>
                                <span className={`badge ${sensor.status === 'Produktif' ? 'success' : 'danger'}`}>
                                    {sensor.status}
                                </span>
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                                {sensor.monthlyTotal}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                telur / bulan · target {monthlyTarget}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Rata-rata {sensor.avgPerDay} telur/hari
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                                Terakhir: {sensor.lastDetectedAt
                                    ? new Date(sensor.lastDetectedAt).toLocaleString('id-ID', {
                                        day: '2-digit', month: 'short',
                                        hour: '2-digit', minute: '2-digit',
                                    })
                                    : 'belum ada'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Chart */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <div className="chart-card-header">
                    <div>
                        <div className="chart-card-title">Produksi Telur Per Sensor</div>
                        <div className="chart-card-subtitle">{monthLabel}</div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyBySensor}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D0" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }}
                            tick={{ fontSize: 11, fill: '#9C8060' }}
                            axisLine={false} tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#9C8060' }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: '#fff', border: '1px solid #EDD8B8', borderRadius: 10, fontSize: 12 }}
                            labelFormatter={(d) => new Date(d as string).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                        />
                        {Object.entries(sensorColors).map(([sensorId, color]) => (
                            <Bar key={sensorId} dataKey={sensorId} stackId="eggs" fill={color} name={sensorId} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Events Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Riwayat Deteksi</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Waktu</th>
                            <th style={thStyle}>ID Sensor</th>
                            <th style={thStyle}>Jumlah</th>
                            <th style={thStyle}>Catatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '70%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '45%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '30%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '50%' }} /></td>
                                </tr>
                            ))
                        ) : eggs.map((e) => (
                            <tr key={e.id}>
                                <td style={tdStyle}>
                                    {new Date(e.createdAt).toLocaleString('id-ID', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </td>
                                <td style={tdStyle}>
                                    <span className="badge" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--success)' }}>
                                        {e.sensorId}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span className="badge warning" style={{ background: 'rgba(212,160,23,0.12)', color: 'var(--primary-dark)' }}>
                                        +{e.count} butir
                                    </span>
                                </td>
                                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{e.notes || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {eggs.length} dari {pagination.total} event
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1} style={pageBtnStyle}><ChevronLeft size={14} /></button>
                        <span style={{ fontSize: 13, padding: '6px 12px', background: 'var(--bg)', borderRadius: 6, fontWeight: 600 }}>{pagination.page} / {pagination.totalPages || 1}</span>
                        <button onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} style={pageBtnStyle}><ChevronRight size={14} /></button>
                    </div>
                </div>
            </div>
        </>
    );
}

const thStyle: React.CSSProperties = {
    padding: '14px 20px', textAlign: 'left', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
    background: 'var(--bg)', borderBottom: '1px solid var(--border-light)',
};

const tdStyle: React.CSSProperties = {
    padding: '12px 20px', borderBottom: '1px solid var(--border-light)',
};

const pageBtnStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', color: 'var(--text-secondary)',
};

const monthInputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 13,
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    outline: 'none',
};


const sensorCardStyle: React.CSSProperties = {
    padding: 14,
    borderRadius: 8,
    border: '1px solid var(--border-light)',
    background: 'var(--bg)',
};
