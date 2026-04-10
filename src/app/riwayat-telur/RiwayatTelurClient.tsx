'use client';

import { useState, useEffect, useCallback } from 'react';
import { Egg, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EggEvent {
    id: string;
    count: number;
    notes: string | null;
    createdAt: string;
}

interface DailySummary {
    date: string;
    total: number;
    events: number;
}

export default function RiwayatTelurClient() {
    const [eggs, setEggs] = useState<EggEvent[]>([]);
    const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true);
        const res = await fetch(`/api/eggs?page=${page}&limit=25`);
        const json = await res.json();
        setEggs(json.data || []);
        setDailySummary(json.dailySummary || []);
        setPagination(json.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalEggs = dailySummary.reduce((sum, d) => sum + d.total, 0);
    const avgPerDay = dailySummary.length > 0 ? (totalEggs / dailySummary.length).toFixed(1) : '0';

    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Riwayat Telur</h2>
                    <p>Data produksi telur harian dan riwayat deteksi 🥚</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
                <div className="summary-card amber">
                    <div className="summary-card-header">
                        <span className="summary-card-label">Total 30 Hari</span>
                        <div className="summary-card-icon amber"><Egg size={18} /></div>
                    </div>
                    <div className="summary-card-value">{totalEggs}</div>
                    <div className="summary-card-sub">butir telur</div>
                </div>
                <div className="summary-card orange">
                    <div className="summary-card-header">
                        <span className="summary-card-label">Rata-rata / Hari</span>
                        <div className="summary-card-icon orange"><Egg size={18} /></div>
                    </div>
                    <div className="summary-card-value">{avgPerDay}</div>
                    <div className="summary-card-sub">butir/hari</div>
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

            {/* Daily Chart */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <div className="chart-card-header">
                    <div>
                        <div className="chart-card-title">📊 Produksi Telur Harian</div>
                        <div className="chart-card-subtitle">30 hari terakhir</div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailySummary}>
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
                        <Bar dataKey="total" fill="#D4A017" radius={[4, 4, 0, 0]} name="Telur" />
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
                            <th style={thStyle}>Jumlah</th>
                            <th style={thStyle}>Catatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    <td style={tdStyle}><div className="skeleton" style={{ height: 14, width: '70%' }} /></td>
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
