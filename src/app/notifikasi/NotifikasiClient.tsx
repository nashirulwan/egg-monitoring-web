'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface Alert {
    id: string;
    type: string;
    severity: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

const severityConfig: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
    info: { icon: Info, cls: 'success', label: 'Info' },
    warning: { icon: AlertTriangle, cls: 'warning', label: 'Peringatan' },
    critical: { icon: AlertCircle, cls: 'danger', label: 'Kritis' },
};

const typeLabels: Record<string, string> = {
    temperature: '🌡️ Suhu',
    humidity: '💧 Kelembapan',
    device_offline: '📡 Perangkat',
};

export default function NotifikasiClient() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/alerts');
        const json = await res.json();
        setAlerts(json.data || []);
        setUnread(json.unread ?? 0);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    const markRead = async (id?: string) => {
        await fetch('/api/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(id ? { id } : {}),
        });
        fetchAlerts();
    };

    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Notifikasi</h2>
                    <p>Peringatan dan alert sistem{unread > 0 ? ` — ${unread} belum dibaca` : ''}</p>
                </div>
                {unread > 0 && (
                    <button onClick={() => markRead()} style={markAllBtnStyle}>
                        <CheckCheck size={14} /> Tandai semua dibaca
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                            <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 6 }} />
                            <div className="skeleton" style={{ height: 12, width: '40%' }} />
                        </div>
                    ))
                ) : alerts.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Bell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p>Tidak ada notifikasi.</p>
                    </div>
                ) : (
                    alerts.map((alert) => {
                        const config = severityConfig[alert.severity] || severityConfig.info;
                        const Icon = config.icon;
                        return (
                            <div
                                key={alert.id}
                                style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid var(--border-light)',
                                    background: alert.isRead ? 'transparent' : 'rgba(212,160,23,0.04)',
                                    display: 'flex',
                                    gap: 14,
                                    alignItems: 'flex-start',
                                    cursor: !alert.isRead ? 'pointer' : 'default',
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => !alert.isRead && markRead(alert.id)}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: alert.severity === 'critical' ? 'rgba(220,38,38,0.08)' : alert.severity === 'warning' ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.08)',
                                    flexShrink: 0,
                                }}>
                                    <Icon size={16} style={{ color: alert.severity === 'critical' ? 'var(--danger)' : alert.severity === 'warning' ? 'var(--warning)' : 'var(--success)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span className={`badge ${config.cls}`}>{config.label}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeLabels[alert.type] || alert.type}</span>
                                        {!alert.isRead && (
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                                        )}
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{alert.message}</p>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                        {new Date(alert.createdAt).toLocaleString('id-ID', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}

const markAllBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--primary)',
    fontSize: 13, fontWeight: 600, background: 'var(--primary)', color: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
