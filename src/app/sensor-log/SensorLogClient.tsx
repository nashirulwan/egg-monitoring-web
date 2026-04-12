'use client';

import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface SensorReading {
    id: string;
    temperature: number;
    humidity: number;
    gasDetected: boolean | null;
    gasValue: number | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function SensorLogPage() {
    const [readings, setReadings] = useState<SensorReading[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: '25' });
        if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
        if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());

        const res = await fetch(`/api/sensors?${params}`);
        const json = await res.json();
        setReadings(json.data || []);
        setPagination(json.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
        setLoading(false);
    }, [dateFrom, dateTo]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void fetchData();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [fetchData]);

    const tempColor = (t: number) => {
        if (t < 36) return 'var(--danger)';
        if (t > 39) return 'var(--danger)';
        if (t >= 37 && t <= 38) return 'var(--success)';
        return 'var(--warning)';
    };

    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Sensor Log</h2>
                    <p>Riwayat data sensor DHT11 — suhu dan kelembapan</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="filter-input"
                        style={inputStyle}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>s/d</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="filter-input"
                        style={inputStyle}
                    />
                    <button onClick={() => fetchData(1)} style={btnStyle}>
                        <Search size={14} /> Cari
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Waktu</th>
                            <th style={thStyle}>Suhu (°C)</th>
                            <th style={thStyle}>Kelembapan (%)</th>
                            <th style={thStyle}>Gas (ADC)</th>
                            <th style={thStyle}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <tr key={i}>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '50%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '50%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '50%' }} /></td>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '60%' }} /></td>
                                </tr>
                            ))
                        ) : readings.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    Tidak ada data untuk rentang waktu ini.
                                </td>
                            </tr>
                        ) : (
                            readings.map((r) => (
                                <tr key={r.id} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                                    <td style={tdStyle}>
                                        {new Date(r.createdAt).toLocaleString('id-ID', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Thermometer size={14} style={{ color: tempColor(r.temperature) }} />
                                            <strong>{r.temperature.toFixed(1)}</strong>
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Droplets size={14} style={{ color: 'var(--accent)' }} />
                                            <strong>{r.humidity.toFixed(1)}</strong>
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span className={`badge ${r.gasDetected ? 'danger' : 'success'}`}>
                                            {r.gasValue !== null ? `${r.gasValue} ADC` : '—'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span className={`badge ${r.temperature >= 37 && r.temperature <= 38 ? 'success' : r.temperature < 36 || r.temperature > 39 ? 'danger' : 'warning'}`}>
                                            {r.temperature >= 37 && r.temperature <= 38 ? 'Normal' : r.temperature < 36 || r.temperature > 39 ? 'Bahaya' : 'Perhatian'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div style={paginationStyle}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Menampilkan {readings.length} dari {pagination.total} data
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => fetchData(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            style={pageBtnStyle}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 13, padding: '6px 12px', background: 'var(--bg)', borderRadius: 6, fontWeight: 600 }}>
                            {pagination.page} / {pagination.totalPages || 1}
                        </span>
                        <button
                            onClick={() => fetchData(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            style={pageBtnStyle}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)',
    outline: 'none',
};

const btnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, background: 'var(--primary)', color: '#fff', fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};

const tableStyle: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
};

const thStyle: React.CSSProperties = {
    padding: '14px 20px', textAlign: 'left', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
    background: 'var(--bg)', borderBottom: '1px solid var(--border-light)',
};

const tdStyle: React.CSSProperties = {
    padding: '12px 20px', borderBottom: '1px solid var(--border-light)',
};

const paginationStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderTop: '1px solid var(--border-light)',
};

const pageBtnStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', color: 'var(--text-secondary)',
};
